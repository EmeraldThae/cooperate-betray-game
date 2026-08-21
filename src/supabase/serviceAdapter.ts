import { getSupabaseCredentials } from './client';
import { SupabaseGameService } from './gameService';
import { ServerGameService } from './serverGameService';
import { MockGameService } from './mockService';
import { Decision, DecisionType, Game, Player, Round } from '../types';

export type BackendMode = 'server' | 'supabase' | 'demo';

const MODE_STORAGE_KEY = 'tb_backend_mode_override';

export function getActiveBackendMode(): BackendMode {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(MODE_STORAGE_KEY) as BackendMode | null;
    if (override === 'demo' || override === 'supabase' || override === 'server') {
      return override;
    }
  }
  const { isConfigured } = getSupabaseCredentials();
  return isConfigured ? 'supabase' : 'server';
}

export function setActiveBackendMode(mode: BackendMode | null) {
  if (typeof window !== 'undefined') {
    if (mode) {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } else {
      localStorage.removeItem(MODE_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('tb_mode_changed', { detail: mode }));
  }
}

export class GameService {
  private static getService() {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') return SupabaseGameService;
    if (mode === 'demo') return MockGameService;
    return ServerGameService;
  }

  static isLiveSupabase(): boolean {
    return getActiveBackendMode() === 'supabase';
  }

  static async createGame(options: {
    totalRounds: number;
    decisionTimeSeconds: number;
    roomName?: string;
  }): Promise<{ game: Game; userId: string }> {
    try {
      return await this.getService().createGame(options);
    } catch (err: any) {
      if (this.isLiveSupabase()) {
        console.warn('Live Supabase failed, falling back to server game service:', err);
        return await ServerGameService.createGame(options);
      }
      try {
        return await ServerGameService.createGame(options);
      } catch {
        return await MockGameService.createGame(options);
      }
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
    try {
      return await this.getService().joinGame(gameCode, playerName, avatar);
    } catch (err: any) {
      if (this.isLiveSupabase()) {
        console.warn('Live Supabase join failed, attempting server fallback:', err);
        return await ServerGameService.joinGame(gameCode, playerName, avatar);
      }
      try {
        return await ServerGameService.joinGame(gameCode, playerName, avatar);
      } catch {
        return await MockGameService.joinGame(gameCode, playerName, avatar);
      }
    }
  }

  static async getGameDetails(gameId: string): Promise<{
    game: Game;
    players: Player[];
    currentRound: Round | null;
    decisions: Decision[];
  }> {
    try {
      return await this.getService().getGameDetails(gameId);
    } catch (err: any) {
      try {
        return await ServerGameService.getGameDetails(gameId);
      } catch {
        return await MockGameService.getGameDetails(gameId);
      }
    }
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    try {
      return await this.getService().startRound(gameId, roundNumber);
    } catch {
      return await ServerGameService.startRound(gameId, roundNumber);
    }
  }

  static async submitDecision(
    roundId: string,
    playerId: string,
    decision: DecisionType,
    gameId?: string
  ): Promise<Decision> {
    try {
      return await this.getService().submitDecision(roundId, playerId, decision, gameId);
    } catch {
      return await ServerGameService.submitDecision(roundId, playerId, decision, gameId);
    }
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    try {
      return await this.getService().revealResults(roundId, gameId);
    } catch {
      return await ServerGameService.revealResults(roundId, gameId);
    }
  }

  static async completeGame(gameId: string): Promise<void> {
    try {
      await this.getService().completeGame(gameId);
    } catch {
      await ServerGameService.completeGame(gameId);
    }
  }

  static async resetGame(gameId: string): Promise<void> {
    try {
      await this.getService().resetGame(gameId);
    } catch {
      await ServerGameService.resetGame(gameId);
    }
  }

  static async addSimulatedPlayer(gameId: string, name: string, avatar: string = '🤖'): Promise<Player> {
    const mode = getActiveBackendMode();
    if (mode === 'demo') {
      return await MockGameService.addSimulatedPlayer(gameId, name, avatar);
    }
    try {
      return await ServerGameService.addSimulatedPlayer(gameId, name, avatar);
    } catch {
      return await MockGameService.addSimulatedPlayer(gameId, name, avatar);
    }
  }

  static async autoSubmitBots(roundId: string, gameId: string): Promise<void> {
    const mode = getActiveBackendMode();
    if (mode === 'demo') {
      return await MockGameService.autoSubmitBots(roundId, gameId);
    }
    try {
      await ServerGameService.autoSubmitBots(roundId, gameId);
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
    const unsubPrimary = this.getService().subscribeToGame(gameId, callbacks);
    const unsubServer = ServerGameService.subscribeToGame(gameId, callbacks);
    const unsubMock = MockGameService.subscribeToGame(gameId, callbacks);

    return () => {
      unsubPrimary();
      unsubServer();
      unsubMock();
    };
  }
}
