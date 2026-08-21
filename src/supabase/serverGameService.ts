import { Decision, DecisionType, Game, Player, Round } from '../types';

export class ServerGameService {
  private static getBaseUrl(): string {
    return '';
  }

  static async createGame(options: {
    totalRounds: number;
    decisionTimeSeconds: number;
    roomName?: string;
  }): Promise<{ game: Game; userId: string }> {
    const res = await fetch(`${this.getBaseUrl()}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create game room on server' }));
      throw new Error(err.error || 'Failed to create game room');
    }

    return await res.json();
  }

  static async joinGame(
    gameCode: string,
    playerName: string,
    avatar: string = '🛡️'
  ): Promise<{
    game: Game;
    player: Player;
    userId: string;
  }> {
    let storedUserId = typeof window !== 'undefined' ? localStorage.getItem('tb_user_id') : null;
    if (!storedUserId) {
      storedUserId = 'user_' + Math.random().toString(36).substring(2, 9);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tb_user_id', storedUserId);
      }
    }

    const res = await fetch(`${this.getBaseUrl()}/api/games/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameCode,
        playerName,
        avatar,
        userId: storedUserId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to join game room' }));
      throw new Error(err.error || 'Failed to join game room');
    }

    return await res.json();
  }

  static async getGameDetails(gameId: string): Promise<{
    game: Game;
    players: Player[];
    currentRound: Round | null;
    decisions: Decision[];
  }> {
    const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get game details' }));
      throw new Error(err.error || 'Failed to get game details');
    }
    return await res.json();
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/start-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundNumber }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to start round' }));
      throw new Error(err.error || 'Failed to start round');
    }
    return await res.json();
  }

  static async submitDecision(
    roundId: string,
    playerId: string,
    decision: DecisionType,
    gameId?: string
  ): Promise<Decision> {
    // If gameId not provided directly, extract from active session or fallback
    const targetGameId = gameId || (typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('trust_betray_session') || '{}').gameId : '');
    const res = await fetch(`${this.getBaseUrl()}/api/games/${targetGameId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, playerId, decision }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit decision' }));
      throw new Error(err.error || 'Failed to submit decision');
    }
    return await res.json();
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reveal results' }));
      throw new Error(err.error || 'Failed to reveal results');
    }
    return await res.json();
  }

  static async completeGame(gameId: string): Promise<void> {
    await fetch(`${this.getBaseUrl()}/api/games/${gameId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static async resetGame(gameId: string): Promise<void> {
    await fetch(`${this.getBaseUrl()}/api/games/${gameId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static async addSimulatedPlayer(gameId: string, name: string, avatar: string = '🤖'): Promise<Player> {
    const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/simulated-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, avatar }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add simulated player' }));
      throw new Error(err.error || 'Failed to add simulated player');
    }
    return await res.json();
  }

  static async autoSubmitBots(roundId: string, gameId: string): Promise<void> {
    await fetch(`${this.getBaseUrl()}/api/games/${gameId}/auto-bots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId }),
    });
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
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;
    let isCleanedUp = false;

    const handlePayload = (data: any) => {
      if (!data) return;
      if (data.game) callbacks.onGameUpdate(data.game);
      if (data.players) callbacks.onPlayersUpdate(data.players);
      if (data.currentRound) callbacks.onRoundUpdate(data.currentRound);
      if (data.decisions) callbacks.onDecisionsUpdate(data.decisions);
    };

    // Polling function for fallback or mobile background wake
    const fetchPoll = async () => {
      if (isCleanedUp) return;
      try {
        const details = await ServerGameService.getGameDetails(gameId);
        if (isCleanedUp) return;
        callbacks.onGameUpdate(details.game);
        callbacks.onPlayersUpdate(details.players);
        if (details.currentRound) callbacks.onRoundUpdate(details.currentRound);
        callbacks.onDecisionsUpdate(details.decisions);
      } catch {
        // Silently retry
      }
    };

    // Attempt Server-Sent Events connection
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        eventSource = new EventSource(`${this.getBaseUrl()}/api/games/${gameId}/stream`);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handlePayload(data);
          } catch (e) {
            console.error('Failed to parse SSE payload:', e);
          }
        };

        eventSource.onerror = () => {
          // On mobile network drop, trigger immediate poll
          fetchPoll();
        };
      } catch (e) {
        console.warn('EventSource failed, using polling fallback');
      }
    }

    // Also run an interval poll every 2.5 seconds to guarantee 100% sync reliability across all devices
    pollInterval = setInterval(fetchPoll, 2500);

    return () => {
      isCleanedUp = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }
}
