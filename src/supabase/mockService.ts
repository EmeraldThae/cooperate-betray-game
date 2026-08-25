import { Decision, DecisionType, Game, GameDetails, Player, Round } from '../types';
import { generateGameCode } from '../utils/gameLogic';

interface MockStore {
  games: Record<string, Game>;
  players: Record<string, Player[]>;
  rounds: Record<string, Round[]>;
  decisions: Record<string, Decision[]>;
}

const STORAGE_KEY = 'tb_mock_db';

function getStore(): MockStore {
  if (typeof window === 'undefined') {
    return { games: {}, players: {}, rounds: {}, decisions: {} };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { games: {}, players: {}, rounds: {}, decisions: {} };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { games: {}, players: {}, rounds: {}, decisions: {} };
  }
}

function saveStore(store: MockStore) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    notifySubscribers();
  }
}

const subscribers = new Set<() => void>();
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('trust_betray_mock_channel');
    broadcastChannel.onmessage = () => {
      subscribers.forEach((cb) => cb());
    };
  } catch (e) {
    // Fallback without BroadcastChannel
  }
}

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'STORE_UPDATED', timestamp: Date.now() });
  }
}

export class MockGameService {
  static async mirrorGame(game: Game) {
    if (!game || !game.id) return;
    const store = getStore();
    store.games[game.id] = game;
    if (!store.players[game.id]) store.players[game.id] = [];
    if (!store.rounds[game.id]) store.rounds[game.id] = [];
    if (!store.decisions[game.id]) store.decisions[game.id] = [];
    saveStore(store);
  }

  static async createGame(options: {
    totalRounds: number;
    decisionTimeSeconds: number;
    roomName?: string;
  }): Promise<{ game: Game; userId: string }> {
    const store = getStore();
    const userId = 'mock_user_' + Math.random().toString(36).substring(2, 9);
    const gameId = 'game_' + Math.random().toString(36).substring(2, 10);
    const code = generateGameCode();
    const now = new Date().toISOString();

    const game: Game = {
      id: gameId,
      game_code: code,
      host_user_id: userId,
      status: 'lobby',
      current_round: 0,
      total_rounds: options.totalRounds,
      decision_time_seconds: options.decisionTimeSeconds,
      room_name: options.roomName || 'Executive Workshop',
      created_at: now,
      updated_at: now,
    };

    store.games[gameId] = game;
    store.players[gameId] = [];
    store.rounds[gameId] = [];
    store.decisions[gameId] = [];
    saveStore(store);

    return { game, userId };
  }

  static async joinGame(gameCode: string, playerName: string, avatar: string = '🛡️'): Promise<{
    game: Game;
    player: Player;
    userId: string;
  }> {
    const store = getStore();
    const rawClean = gameCode.toUpperCase().replace(/[\s\-_]+/g, '').trim();
    const targetSuffix = rawClean.startsWith('TB') ? rawClean.substring(2) : rawClean;
    const formattedCode = `TB-${targetSuffix}`;
    const game = Object.values(store.games).find((g) => {
      const gClean = g.game_code.toUpperCase().replace(/[\s\-_]+/g, '');
      const gSuffix = gClean.startsWith('TB') ? gClean.substring(2) : gClean;
      return gSuffix === targetSuffix || g.game_code === formattedCode;
    });

    if (!game) {
      throw new Error(`Game code "${formattedCode}" not found. Please verify the code or check your connection.`);
    }

    if (game.status === 'completed') {
      throw new Error('This game session has already finished.');
    }

    const currentPlayers = store.players[game.id] || [];
    let userId = localStorage.getItem('tb_user_id') || 'mock_user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('tb_user_id', userId);

    const nameConflict = currentPlayers.find(
      (p) => p.player_name.toLowerCase() === playerName.toLowerCase().trim() && p.user_id !== userId
    );
    if (nameConflict) {
      throw new Error(`Player name "${playerName}" is already in use.`);
    }

    const existingSelf = currentPlayers.find((p) => p.user_id === userId);
    if (existingSelf) {
      existingSelf.player_name = playerName.trim();
      existingSelf.avatar = avatar;
      existingSelf.last_seen_at = new Date().toISOString();
      saveStore(store);
      return { game, player: existingSelf, userId };
    }

    const newPlayer: Player = {
      id: 'player_' + Math.random().toString(36).substring(2, 10),
      game_id: game.id,
      user_id: userId,
      player_name: playerName.trim(),
      score: 0,
      status: 'waiting',
      avatar,
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    currentPlayers.push(newPlayer);
    store.players[game.id] = currentPlayers;
    saveStore(store);

    return { game, player: newPlayer, userId };
  }

  static async addSimulatedPlayer(gameId: string, name: string, avatar: string = '🤖'): Promise<Player> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) throw new Error('Game not found');

    const currentPlayers = store.players[gameId] || [];
    const simulatedPlayer: Player = {
      id: 'bot_' + Math.random().toString(36).substring(2, 9),
      game_id: gameId,
      user_id: 'bot_user_' + Math.random().toString(36).substring(2, 9),
      player_name: name,
      score: 0,
      status: game.status === 'round_active' ? 'playing' : 'waiting',
      avatar,
      joined_at: new Date().toISOString(),
    };

    currentPlayers.push(simulatedPlayer);
    store.players[gameId] = currentPlayers;
    saveStore(store);
    return simulatedPlayer;
  }

  static async getGameDetails(gameId: string): Promise<GameDetails> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) throw new Error('Game not found.');

    const players = store.players[gameId] || [];
    const rounds = store.rounds[gameId] || [];
    const currentRound = rounds.find((r) => r.round_number === game.current_round) || null;
    const allDecs = store.decisions[gameId] || [];
    const currentDecisions = currentRound ? allDecs.filter((d) => d.round_id === currentRound.id) : [];

    return {
      game,
      players: [...players].sort((a, b) => b.score - a.score),
      currentRound,
      decisions: currentDecisions,
      rounds,
      allDecisions: allDecs,
    };
  }

  static async randomizePairings(gameId: string, roundNumber?: number): Promise<{ pairings: any[] }> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) throw new Error('Game not found');

    const pList = store.players[gameId] || [];
    const rNum = roundNumber || game.current_round || 1;
    const shuffled = [...pList].sort(() => 0.5 - Math.random());
    const pairs: any[] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      pairs.push({
        id: `pair_${rNum}_${Math.random().toString(36).substring(2, 8)}`,
        round_number: rNum,
        player1_id: shuffled[i].id,
        player2_id: shuffled[i + 1].id,
      });
    }
    if (shuffled.length % 2 !== 0 && shuffled.length >= 3) {
      pairs.push({
        id: `pair_${rNum}_odd_${Math.random().toString(36).substring(2, 8)}`,
        round_number: rNum,
        player1_id: shuffled[shuffled.length - 1].id,
        player2_id: shuffled[0].id,
      });
    }

    game.current_pairings = pairs;
    const rList = store.rounds[gameId] || [];
    const currentRound = rList.find((r) => r.round_number === rNum);
    if (currentRound) {
      currentRound.pairings = pairs;
    }
    saveStore(store);
    return { pairings: pairs };
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) throw new Error('Game not found');

    const now = new Date().toISOString();
    game.status = 'round_active';
    game.current_round = roundNumber;
    game.updated_at = now;

    // Reset player statuses
    const players = store.players[gameId] || [];
    players.forEach((p) => {
      p.status = 'playing';
    });

    const rounds = store.rounds[gameId] || [];
    let round = rounds.find((r) => r.round_number === roundNumber);
    if (!round) {
      round = {
        id: 'round_' + Math.random().toString(36).substring(2, 10),
        game_id: gameId,
        round_number: roundNumber,
        status: 'active',
        started_at: now,
      };
      rounds.push(round);
    } else {
      round.status = 'active';
      round.started_at = now;
    }

    store.rounds[gameId] = rounds;
    saveStore(store);

    return round;
  }

  static async submitDecision(roundId: string, playerId: string, decision: DecisionType): Promise<Decision> {
    const store = getStore();
    let targetGameId: string | null = null;

    for (const [gId, rounds] of Object.entries(store.rounds)) {
      if (rounds.some((r) => r.id === roundId)) {
        targetGameId = gId;
        break;
      }
    }

    if (!targetGameId) throw new Error('Round not found.');

    const decs = store.decisions[targetGameId] || [];
    let existing = decs.find((d) => d.round_id === roundId && d.player_id === playerId);

    if (existing) {
      existing.decision = decision;
      existing.submitted_at = new Date().toISOString();
    } else {
      existing = {
        id: 'dec_' + Math.random().toString(36).substring(2, 10),
        round_id: roundId,
        player_id: playerId,
        decision,
        points: 0,
        submitted_at: new Date().toISOString(),
      };
      decs.push(existing);
    }

    store.decisions[targetGameId] = decs;

    // Update player status
    const players = store.players[targetGameId] || [];
    const player = players.find((p) => p.id === playerId);
    if (player) {
      player.status = 'submitted';
    }

    saveStore(store);
    return existing;
  }

  static async autoSubmitBots(roundId: string, gameId: string) {
    const store = getStore();
    const players = store.players[gameId] || [];
    const decs = store.decisions[gameId] || [];

    for (const p of players) {
      if (p.id.startsWith('bot_')) {
        const hasDec = decs.some((d) => d.round_id === roundId && d.player_id === p.id);
        if (!hasDec) {
          // 65% chance cooperate, 35% betray
          const choice: DecisionType = Math.random() < 0.65 ? 'cooperate' : 'betray';
          decs.push({
            id: 'dec_' + Math.random().toString(36).substring(2, 10),
            round_id: roundId,
            player_id: p.id,
            decision: choice,
            points: 0,
            submitted_at: new Date().toISOString(),
          });
          p.status = 'submitted';
        }
      }
    }
    store.decisions[gameId] = decs;
    saveStore(store);
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) throw new Error('Game not found');

    const rounds = store.rounds[gameId] || [];
    const round = rounds.find((r) => r.id === roundId);
    if (!round) throw new Error('Round not found');

    // Auto submit any missing decisions as 'no_decision'
    const players = store.players[gameId] || [];
    const decs = store.decisions[gameId] || [];
    const now = new Date().toISOString();

    players.forEach((p) => {
      if (!decs.some((d) => d.round_id === roundId && d.player_id === p.id)) {
        decs.push({
          id: 'dec_' + Math.random().toString(36).substring(2, 10),
          round_id: roundId,
          player_id: p.id,
          decision: 'no_decision',
          points: 0,
          submitted_at: now,
        });
      }
    });

    const currentRoundDecs = decs.filter((d) => d.round_id === roundId);
    const validDecs = currentRoundDecs.filter((d) => d.decision !== 'no_decision');
    const coopCount = validDecs.filter((d) => d.decision === 'cooperate').length;
    const betrayCount = validDecs.filter((d) => d.decision === 'betray').length;

    currentRoundDecs.forEach((dec) => {
      let pts = 0;
      if (dec.decision === 'no_decision') {
        pts = 0;
      } else if (betrayCount === 0 && coopCount > 0) {
        pts = 3;
      } else if (coopCount === 0 && betrayCount > 0) {
        pts = 1;
      } else {
        pts = dec.decision === 'betray' ? 5 : 0;
      }
      dec.points = pts;

      // Increment player score if not already revealed
      if (round.status !== 'revealed' && round.status !== 'completed') {
        const player = players.find((p) => p.id === dec.player_id);
        if (player) {
          player.score += pts;
          player.status = 'ready';
        }
      }
    });

    round.status = 'revealed';
    round.revealed_at = now;
    round.ended_at = now;
    game.status = 'results';
    game.updated_at = now;

    store.decisions[gameId] = decs;
    saveStore(store);

    return { success: true, roundId };
  }

  static async completeGame(gameId: string): Promise<void> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) return;

    game.status = 'completed';
    game.updated_at = new Date().toISOString();
    const players = store.players[gameId] || [];
    players.forEach((p) => {
      p.status = 'completed';
    });
    saveStore(store);
  }

  static async resetGame(gameId: string): Promise<void> {
    const store = getStore();
    const game = store.games[gameId];
    if (!game) return;

    game.status = 'lobby';
    game.current_round = 0;
    game.updated_at = new Date().toISOString();
    store.rounds[gameId] = [];
    store.decisions[gameId] = [];
    const players = store.players[gameId] || [];
    players.forEach((p) => {
      p.score = 0;
      p.status = 'waiting';
    });
    saveStore(store);
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
    const listener = () => {
      const store = getStore();
      const game = store.games[gameId];
      if (game) callbacks.onGameUpdate(game);

      const players = store.players[gameId] || [];
      callbacks.onPlayersUpdate([...players].sort((a, b) => b.score - a.score));

      if (game && game.current_round > 0) {
        const rounds = store.rounds[gameId] || [];
        const currentRound = rounds.find((r) => r.round_number === game.current_round);
        if (currentRound) {
          callbacks.onRoundUpdate(currentRound);
          const allDecs = store.decisions[gameId] || [];
          const currentDecs = allDecs.filter((d) => d.round_id === currentRound.id);
          callbacks.onDecisionsUpdate(currentDecs);
        }
      }
    };

    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }
}
