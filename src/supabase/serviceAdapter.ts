import { getSupabaseCredentials } from './client';
import { SupabaseGameService } from './gameService';
import { MockGameService } from './mockService';
import { Decision, DecisionType, Game, Player, Round } from '../types';

export type BackendMode = 'supabase' | 'demo';

const MODE_STORAGE_KEY = 'tb_backend_mode_override';

export function getActiveBackendMode(): BackendMode {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(MODE_STORAGE_KEY) as BackendMode | null;
    if (override === 'demo' || override === 'supabase') {
      return override;
    }
  }
  const { isConfigured } = getSupabaseCredentials();
  return isConfigured ? 'supabase' : 'demo';
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
    return mode === 'supabase' ? SupabaseGameService : MockGameService;
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
        console.warn('Live Supabase failed, falling back to local simulation:', err);
        return await MockGameService.createGame(options);
      }
      throw err;
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
        console.warn('Live Supabase join failed, attempting mock fallback:', err);
        return await MockGameService.joinGame(gameCode, playerName, avatar);
      }
      throw err;
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
      return await MockGameService.getGameDetails(gameId);
    }
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    return await this.getService().startRound(gameId, roundNumber);
  }

  static async submitDecision(
    roundId: string,
    playerId: string,
    decision: DecisionType
  ): Promise<Decision> {
    return await this.getService().submitDecision(roundId, playerId, decision);
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    return await this.getService().revealResults(roundId, gameId);
  }

  static async completeGame(gameId: string): Promise<void> {
    await this.getService().completeGame(gameId);
  }

  static async resetGame(gameId: string): Promise<void> {
    await this.getService().resetGame(gameId);
  }

  static async addSimulatedPlayer(gameId: string, name: string, avatar: string = '🤖'): Promise<Player> {
    return await MockGameService.addSimulatedPlayer(gameId, name, avatar);
  }

  static async autoSubmitBots(roundId: string, gameId: string): Promise<void> {
    return await MockGameService.autoSubmitBots(roundId, gameId);
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
    // Also attach mock channel so demo bots or multi-tab local test actions notify seamlessly
    const unsubMock = MockGameService.subscribeToGame(gameId, callbacks);

    return () => {
      unsubPrimary();
      unsubMock();
    };
  }
}
