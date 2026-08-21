export type GameStatus =
  | 'lobby'
  | 'round_active'
  | 'waiting_for_reveal'
  | 'results'
  | 'completed';

export type PlayerStatus =
  | 'waiting'
  | 'ready'
  | 'playing'
  | 'submitted'
  | 'disconnected'
  | 'completed';

export type RoundStatus =
  | 'pending'
  | 'active'
  | 'waiting_for_reveal'
  | 'revealed'
  | 'completed';

export type DecisionType = 'cooperate' | 'betray' | 'no_decision';

export interface Game {
  id: string;
  game_code: string;
  host_user_id: string;
  status: GameStatus;
  current_round: number;
  total_rounds: number;
  decision_time_seconds: number;
  room_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  user_id: string;
  player_name: string;
  score: number;
  status: PlayerStatus;
  avatar?: string;
  is_host?: boolean;
  joined_at: string;
  last_seen_at?: string;
}

export interface Round {
  id: string;
  game_id: string;
  round_number: number;
  status: RoundStatus;
  started_at: string;
  ended_at?: string | null;
  revealed_at?: string | null;
}

export interface Decision {
  id: string;
  round_id: string;
  player_id: string;
  decision: DecisionType;
  points: number;
  submitted_at: string;
  // Augmented client-side fields when revealed
  player_name?: string;
  avatar?: string;
}

export interface GameEvent {
  id: string;
  game_id: string;
  round_id?: string;
  event_type:
    | 'game_created'
    | 'player_joined'
    | 'player_left'
    | 'game_started'
    | 'round_started'
    | 'player_submitted'
    | 'results_revealed'
    | 'next_round'
    | 'game_completed';
  created_at: string;
  metadata?: Record<string, any>;
}

export interface RoundResultSummary {
  round_number: number;
  cooperate_count: number;
  betray_count: number;
  no_decision_count: number;
  total_players: number;
  outcome_type: 'all_cooperate' | 'all_betray' | 'mixed' | 'all_timeout';
  player_results: {
    player_id: string;
    player_name: string;
    avatar?: string;
    decision: DecisionType;
    points_awarded: number;
    previous_score: number;
    new_score: number;
  }[];
}

export interface GameStatistics {
  total_rounds_played: number;
  total_players: number;
  total_cooperations: number;
  total_betrayals: number;
  total_no_decisions: number;
  cooperation_rate_pct: number;
  betrayal_rate_pct: number;
  highest_score: number;
  winner_names: string[];
  most_cooperative_player?: { name: string; cooperate_count: number; rate: number };
  biggest_betrayer?: { name: string; betray_count: number; rate: number };
}

export interface SessionState {
  role: 'host' | 'player' | null;
  gameId: string | null;
  gameCode: string | null;
  userId: string | null;
  playerId: string | null;
  playerName: string | null;
}
