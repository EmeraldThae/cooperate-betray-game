import { getSupabaseCredentials } from './client';
import { SupabaseGameService } from './gameService';
import { ServerGameService } from './serverGameService';
import { MockGameService } from './mockService';
import { Decision, DecisionType, Game, GameDetails, Player, Round } from '../types';

export type BackendMode = 'server' | 'supabase' | 'demo';

const MODE_STORAGE_KEY = 'tb_backend_mode_override';

export function getActiveBackendMode(): BackendMode {
  if (typeof window !== 'undefined') {
    // Purge any legacy 'demo' overrides so cross-device networking works properly
    localStorage.removeItem('tb_supabase_mode');
    const override = localStorage.getItem(MODE_STORAGE_KEY) as BackendMode | null;
    if (override === 'supabase' || override === 'server') {
      return override;
    }
  }

  const { isConfigured } = getSupabaseCredentials();
  return isConfigured ? 'supabase' : 'server';
}

export function setActiveBackendMode(mode: BackendMode | null) {
  if (typeof window !== 'undefined') {
    if (mode && mode !== 'demo') {
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
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.createGame(options);
    }
    return await ServerGameService.createGame(options);
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
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.joinGame(gameCode, playerName, avatar);
    }
    return await ServerGameService.joinGame(gameCode, playerName, avatar);
  }

  static async getGameDetails(gameId: string): Promise<GameDetails> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.getGameDetails(gameId);
    }
    return await ServerGameService.getGameDetails(gameId);
  }

  static async randomizePairings(gameId: string, roundNumber?: number): Promise<{ pairings: any[] }> {
    const mode = getActiveBackendMode();
    if (mode === 'demo') {
      return await MockGameService.randomizePairings(gameId, roundNumber);
    }
    return await ServerGameService.randomizePairings(gameId, roundNumber);
  }

  static async startRound(gameId: string, roundNumber: number): Promise<Round> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.startRound(gameId, roundNumber);
    }
    if (mode === 'demo') {
      return await MockGameService.startRound(gameId, roundNumber);
    }
    return await ServerGameService.startRound(gameId, roundNumber);
  }

  static async submitDecision(
    roundId: string,
    playerId: string,
    decision: DecisionType,
    gameId?: string
  ): Promise<Decision> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.submitDecision(roundId, playerId, decision);
    }
    if (mode === 'demo') {
      return await MockGameService.submitDecision(roundId, playerId, decision);
    }
    return await ServerGameService.submitDecision(roundId, playerId, decision, gameId);
  }

  static async revealResults(roundId: string, gameId: string): Promise<any> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.revealResults(roundId, gameId);
    }
    if (mode === 'demo') {
      return await MockGameService.revealResults(roundId, gameId);
    }
    return await ServerGameService.revealResults(roundId, gameId);
  }

  static async completeGame(gameId: string): Promise<void> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.completeGame(gameId);
    }
    if (mode === 'demo') {
      return await MockGameService.completeGame(gameId);
    }
    return await ServerGameService.completeGame(gameId);
  }

  static async resetGame(gameId: string): Promise<void> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return await SupabaseGameService.resetGame(gameId);
    }
    if (mode === 'demo') {
      return await MockGameService.resetGame(gameId);
    }
    return await ServerGameService.resetGame(gameId);
  }

  static async addSimulatedPlayer(gameId: string, name: string, avatar: string = '🤖'): Promise<Player> {
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      // In supabase mode, simulated player is not standard unless mocked
      return await ServerGameService.addSimulatedPlayer(gameId, name, avatar);
    }
    if (mode === 'demo') {
      return await MockGameService.addSimulatedPlayer(gameId, name, avatar);
    }
    return await ServerGameService.addSimulatedPlayer(gameId, name, avatar);
  }

  static async autoSubmitBots(roundId: string, gameId: string): Promise<void> {
    const mode = getActiveBackendMode();
    if (mode === 'demo') {
      return await MockGameService.autoSubmitBots(roundId, gameId);
    }
    return await ServerGameService.autoSubmitBots(roundId, gameId);
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
    const mode = getActiveBackendMode();
    if (mode === 'supabase') {
      return SupabaseGameService.subscribeToGame(gameId, callbacks);
    }
    if (mode === 'demo') {
      return MockGameService.subscribeToGame(gameId, callbacks);
    }
    return ServerGameService.subscribeToGame(gameId, callbacks);
  }
}
