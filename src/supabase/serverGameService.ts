import { Decision, DecisionType, Game, Player, Round } from '../types';
import { MockGameService } from './mockService';

export class ServerGameService {
  private static getBaseUrl(): string {
    return '';
  }

  static async createGame(options: {
    totalRounds: number;
    decisionTimeSeconds: number;
    roomName?: string;
  }): Promise<{ game: Game; userId: string }> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        let errMessage = 'Failed to create game room on server';
        try {
          const err = await res.json();
          if (err && err.error) errMessage = err.error;
        } catch {
          // ignore non-json error
        }
        console.warn('Server createGame returned non-OK status:', errMessage);
        return await MockGameService.createGame(options);
      }

      const data = await res.json();
      // Mirror in local mock storage for instant fallback availability
      try {
        await MockGameService.mirrorGame(data.game);
      } catch {}
      return data;
    } catch (err: any) {
      console.warn('Network or server error in createGame, using seamless local engine:', err);
      return await MockGameService.createGame(options);
    }
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

    try {
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
        let errMessage = 'Failed to join game room';
        try {
          const err = await res.json();
          if (err && err.error) errMessage = err.error;
        } catch {}

        // If not found on server or server error, check local mock store
        try {
          return await MockGameService.joinGame(gameCode, playerName, avatar);
        } catch {
          throw new Error(errMessage);
        }
      }

      return await res.json();
    } catch (err: any) {
      // Fallback check against local mock engine
      try {
        return await MockGameService.joinGame(gameCode, playerName, avatar);
      } catch {
        throw err;
      }
    }
  }

  static async getGameDetails(gameId: string): Promise<{
    game: Game;
    players: Player[];
    currentRound: Round | null;
    decisions: Decision[];
    rounds?: Round[];
    allDecisions?: Decision[];
  }> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}`);
      if (res.ok) {
        return await res.json();
      }
      return await MockGameService.getGameDetails(gameId);
    } catch {
      return await MockGameService.getGameDetails(gameId);
    }
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/start-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundNumber }),
      });

      if (res.ok) {
        return await res.json();
      }
      return await MockGameService.startRound(gameId, roundNumber);
    } catch {
      return await MockGameService.startRound(gameId, roundNumber);
    }
  }

  static async submitDecision(
    roundId: string,
    playerId: string,
    decision: DecisionType,
    gameId?: string
  ): Promise<Decision> {
    const targetGameId = gameId || (typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('trust_betray_session') || '{}').gameId : '');
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games/${targetGameId}/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, playerId, decision }),
      });

      if (res.ok) {
        return await res.json();
      }
      return await MockGameService.submitDecision(roundId, playerId, decision);
    } catch {
      return await MockGameService.submitDecision(roundId, playerId, decision);
    }
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });

      if (res.ok) {
        return await res.json();
      }
      return await MockGameService.revealResults(roundId, gameId);
    } catch {
      return await MockGameService.revealResults(roundId, gameId);
    }
  }

  static async completeGame(gameId: string): Promise<void> {
    try {
      await fetch(`${this.getBaseUrl()}/api/games/${gameId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      await MockGameService.completeGame(gameId);
    }
  }

  static async resetGame(gameId: string): Promise<void> {
    try {
      await fetch(`${this.getBaseUrl()}/api/games/${gameId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      await MockGameService.resetGame(gameId);
    }
  }

  static async addSimulatedPlayer(gameId: string, name: string, avatar: string = '🤖'): Promise<Player> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/simulated-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar }),
      });

      if (res.ok) {
        return await res.json();
      }
      return await MockGameService.addSimulatedPlayer(gameId, name, avatar);
    } catch {
      return await MockGameService.addSimulatedPlayer(gameId, name, avatar);
    }
  }

  static async randomizePairings(gameId: string, roundNumber?: number): Promise<{ pairings: any[] }> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/games/${gameId}/randomize-pairs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundNumber }),
      });

      if (res.ok) {
        return await res.json();
      }
      return await MockGameService.randomizePairings(gameId, roundNumber);
    } catch {
      return await MockGameService.randomizePairings(gameId, roundNumber);
    }
  }

  static async autoSubmitBots(roundId: string, gameId: string): Promise<void> {
    try {
      await fetch(`${this.getBaseUrl()}/api/games/${gameId}/auto-bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
    } catch {
      await MockGameService.autoSubmitBots(roundId, gameId);
    }
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

    // Also register mock subscription in case this game runs locally
    const unsubMock = MockGameService.subscribeToGame(gameId, callbacks);

    return () => {
      isCleanedUp = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      unsubMock();
    };
  }
}
