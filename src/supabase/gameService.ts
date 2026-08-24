import { getSupabaseClient } from './client';
import { Decision, DecisionType, Game, GameDetails, GameEvent, Player, Round } from '../types';
import { generateGameCode } from '../utils/gameLogic';

export class SupabaseGameService {
  private static getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase client is not configured. Please enter your credentials or use the setup guide.');
    }
    return client;
  }

  static async ensureAuthUser(): Promise<string> {
    const client = this.getClient();
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      return session.user.id;
    }
    // Attempt anonymous sign-in or create a local persistent auth ID
    try {
      const { data: anonData, error: anonError } = await client.auth.signInAnonymously();
      if (!anonError && anonData.user) {
        return anonData.user.id;
      }
    } catch (e) {
      // If anonymous auth is disabled on their Supabase project, fall back to local ID
    }

    let localUid = localStorage.getItem('tb_user_id');
    if (!localUid) {
      localUid = 'user_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
      localStorage.setItem('tb_user_id', localUid);
    }
    return localUid;
  }

  static async createGame(options: {
    totalRounds: number;
    decisionTimeSeconds: number;
    roomName?: string;
  }): Promise<{ game: Game; userId: string }> {
    const client = this.getClient();
    const userId = await this.ensureAuthUser();
    const code = generateGameCode();

    // Try RPC first if available
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('create_game_with_code', {
        p_host_user_id: userId,
        p_total_rounds: options.totalRounds,
        p_decision_time_seconds: options.decisionTimeSeconds,
        p_room_name: options.roomName || 'Corporate Workshop',
      });

      if (!rpcError && rpcData?.game_id) {
        const { data: newGame } = await client
          .from('games')
          .select('*')
          .eq('id', rpcData.game_id)
          .single();
        if (newGame) return { game: newGame as Game, userId };
      }
    } catch (e) {
      // Fall back to direct insert
    }

    // Direct table insert
    const { data, error } = await client
      .from('games')
      .insert([
        {
          game_code: code,
          host_user_id: userId,
          status: 'lobby',
          current_round: 0,
          total_rounds: options.totalRounds,
          decision_time_seconds: options.decisionTimeSeconds,
          room_name: options.roomName || 'Corporate Workshop',
        },
      ])
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create game room.');
    }

    return { game: data as Game, userId };
  }

  static async joinGame(gameCode: string, playerName: string, avatar: string = '🛡️'): Promise<{
    game: Game;
    player: Player;
    userId: string;
  }> {
    const client = this.getClient();
    const userId = await this.ensureAuthUser();
    const formattedCode = gameCode.toUpperCase().trim();

    // 1. Fetch game
    const { data: game, error: gameError } = await client
      .from('games')
      .select('*')
      .eq('game_code', formattedCode)
      .single();

    if (gameError || !game) {
      throw new Error(`Game code "${formattedCode}" not found. Please check and retry.`);
    }

    if (game.status === 'completed') {
      throw new Error('This game session has already finished.');
    }

    // 2. Check if player already exists in this game for this user or name
    const { data: existingPlayers } = await client
      .from('players')
      .select('*')
      .eq('game_id', game.id);

    const nameConflict = existingPlayers?.find(
      (p) => p.player_name.toLowerCase() === playerName.toLowerCase().trim() && p.user_id !== userId
    );
    if (nameConflict) {
      throw new Error(`Player name "${playerName}" is already taken in this room.`);
    }

    const existingSelf = existingPlayers?.find((p) => p.user_id === userId);
    if (existingSelf) {
      // Update name & avatar if changed
      const { data: updatedSelf } = await client
        .from('players')
        .update({ player_name: playerName.trim(), avatar, last_seen_at: new Date().toISOString() })
        .eq('id', existingSelf.id)
        .select()
        .single();
      return { game: game as Game, player: (updatedSelf || existingSelf) as Player, userId };
    }

    // 3. Insert new player
    const isHost = game.host_user_id === userId;
    const { data: newPlayer, error: joinError } = await client
      .from('players')
      .insert([
        {
          game_id: game.id,
          user_id: userId,
          player_name: playerName.trim(),
          score: 0,
          status: 'waiting',
          avatar,
        },
      ])
      .select()
      .single();

    if (joinError || !newPlayer) {
      throw new Error(joinError?.message || 'Failed to join game.');
    }

    return { game: game as Game, player: newPlayer as Player, userId };
  }

  static async getGameDetails(gameId: string): Promise<GameDetails> {
    const client = this.getClient();
    const { data: game, error: gameError } = await client
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      throw new Error('Game not found.');
    }

    const { data: players } = await client
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('score', { ascending: false });

    const { data: allRoundsData } = await client
      .from('rounds')
      .select('*')
      .eq('game_id', gameId)
      .order('round_number', { ascending: true });

    const rounds = (allRoundsData as Round[]) || [];
    let currentRound: Round | null = rounds.find((r) => r.round_number === game.current_round) || null;
    let decisions: Decision[] = [];

    const { data: allDecisionsData } = await client
      .from('decisions')
      .select('*')
      .in('round_id', rounds.map((r) => r.id));

    const allDecisions = (allDecisionsData as Decision[]) || [];
    if (currentRound) {
      decisions = allDecisions.filter((d) => d.round_id === currentRound.id);
    }

    return {
      game: game as Game,
      players: (players as Player[]) || [],
      currentRound,
      decisions,
      rounds,
      allDecisions,
    };
  }

  static async startGame(gameId: string): Promise<Round> {
    return this.startRound(gameId, 1);
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    const client = this.getClient();
    const now = new Date().toISOString();

    // 1. Update game status
    await client
      .from('games')
      .update({
        status: 'round_active',
        current_round: roundNumber,
        updated_at: now,
      })
      .eq('id', gameId);

    // 2. Reset player statuses to 'playing'
    await client
      .from('players')
      .update({ status: 'playing' })
      .eq('game_id', gameId);

    // 3. Create or activate round
    const { data: existingRound } = await client
      .from('rounds')
      .select('*')
      .eq('game_id', gameId)
      .eq('round_number', roundNumber)
      .maybeSingle();

    if (existingRound) {
      const { data: updatedRound } = await client
        .from('rounds')
        .update({ status: 'active', started_at: now })
        .eq('id', existingRound.id)
        .select()
        .single();
      return updatedRound as Round;
    }

    const { data: newRound, error } = await client
      .from('rounds')
      .insert([
        {
          game_id: gameId,
          round_number: roundNumber,
          status: 'active',
          started_at: now,
        },
      ])
      .select()
      .single();

    if (error || !newRound) {
      throw new Error(error?.message || 'Failed to start round.');
    }

    return newRound as Round;
  }

  static async submitDecision(roundId: string, playerId: string, decision: DecisionType): Promise<Decision> {
    const client = this.getClient();
    const now = new Date().toISOString();

    // Insert or update decision
    const { data, error } = await client
      .from('decisions')
      .upsert(
        [
          {
            round_id: roundId,
            player_id: playerId,
            decision,
            points: 0,
            submitted_at: now,
          },
        ],
        { onConflict: 'round_id,player_id' }
      )
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to submit decision.');
    }

    // Update player status to submitted
    await client
      .from('players')
      .update({ status: 'submitted', last_seen_at: now })
      .eq('id', playerId);

    return data as Decision;
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    const client = this.getClient();

    // 1. Try RPC secure calculation
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('reveal_round_scores_secure', {
        p_round_id: roundId,
      });
      if (!rpcError && rpcData) {
        return rpcData;
      }
    } catch (e) {
      // Fall back to client calculation if RPC is missing
    }

    // Fallback client calculation if RPC is not present
    const { data: round } = await client.from('rounds').select('*').eq('id', roundId).single();
    const { data: players } = await client.from('players').select('*').eq('game_id', gameId);
    const { data: decisions } = await client.from('decisions').select('*').eq('round_id', roundId);

    const now = new Date().toISOString();
    const playerList = (players as Player[]) || [];
    const decisionList = (decisions as Decision[]) || [];

    // Ensure all players have decision records (mark missing as no_decision)
    for (const player of playerList) {
      if (!decisionList.find((d) => d.player_id === player.id)) {
        await client.from('decisions').upsert([
          {
            round_id: roundId,
            player_id: player.id,
            decision: 'no_decision',
            points: 0,
            submitted_at: now,
          },
        ]);
      }
    }

    // Re-fetch all decisions
    const { data: updatedDecs } = await client.from('decisions').select('*').eq('round_id', roundId);
    const finalDecs = (updatedDecs as Decision[]) || [];

    const validDecs = finalDecs.filter((d) => d.decision !== 'no_decision');
    const coopCount = validDecs.filter((d) => d.decision === 'cooperate').length;
    const betrayCount = validDecs.filter((d) => d.decision === 'betray').length;

    for (const dec of finalDecs) {
      let pts = 0;
      if (dec.decision === 'no_decision') {
        pts = 0;
      } else if (betrayCount === 0 && coopCount > 0) {
        pts = 3; // All cooperated
      } else if (coopCount === 0 && betrayCount > 0) {
        pts = 1; // All betrayed
      } else {
        pts = dec.decision === 'betray' ? 5 : 0;
      }

      await client.from('decisions').update({ points: pts }).eq('id', dec.id);

      // Only increment player score if round was not already revealed
      if (round && round.status !== 'revealed' && round.status !== 'completed') {
        const p = playerList.find((pl) => pl.id === dec.player_id);
        if (p) {
          await client.from('players').update({ score: p.score + pts, status: 'ready' }).eq('id', p.id);
        }
      }
    }

    await client.from('rounds').update({ status: 'revealed', revealed_at: now, ended_at: now }).eq('id', roundId);
    await client.from('games').update({ status: 'results', updated_at: now }).eq('id', gameId);

    return { success: true, roundId };
  }

  static async completeGame(gameId: string): Promise<void> {
    const client = this.getClient();
    const now = new Date().toISOString();
    await client.from('games').update({ status: 'completed', updated_at: now }).eq('id', gameId);
    await client.from('players').update({ status: 'completed' }).eq('game_id', gameId);
  }

  static async resetGame(gameId: string): Promise<void> {
    const client = this.getClient();
    const now = new Date().toISOString();
    await client.from('games').update({ status: 'lobby', current_round: 0, updated_at: now }).eq('id', gameId);
    await client.from('players').update({ score: 0, status: 'waiting' }).eq('game_id', gameId);
    await client.from('rounds').delete().eq('game_id', gameId);
  }

  static subscribeToGame(
    gameId: string,
    callbacks: {
      onGameUpdate: (game: Game) => void;
      onPlayersUpdate: (players: Player[]) => void;
      onRoundUpdate: (round: Round) => void;
      onDecisionsUpdate: (decisions: Decision[]) => void;
    }
  ): () => void {
    const client = this.getClient();

    const channel = client
      .channel(`game_channel_${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.new) callbacks.onGameUpdate(payload.new as Game);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        async () => {
          const { data } = await client
            .from('players')
            .select('*')
            .eq('game_id', gameId)
            .order('score', { ascending: false });
          if (data) callbacks.onPlayersUpdate(data as Player[]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.new) callbacks.onRoundUpdate(payload.new as Round);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'decisions' },
        async () => {
          // Re-fetch decisions
          const { data: gameData } = await client.from('games').select('current_round').eq('id', gameId).single();
          if (gameData && gameData.current_round > 0) {
            const { data: roundData } = await client
              .from('rounds')
              .select('id')
              .eq('game_id', gameId)
              .eq('round_number', gameData.current_round)
              .maybeSingle();

            if (roundData) {
              const { data: decs } = await client
                .from('decisions')
                .select('*')
                .eq('round_id', roundData.id);
              if (decs) callbacks.onDecisionsUpdate(decs as Decision[]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }
}
