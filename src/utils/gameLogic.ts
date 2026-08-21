import { Decision, DecisionType, Game, GameStatistics, Player, RoundResultSummary } from '../types';

export const AVATAR_OPTIONS = [
  '🛡️', '⚡', '🦅', '🦁', '🐺', '🦊', '🦉', '🐉', '🎯', '♟️', '💎', '🚀'
];

/**
 * Generate unique uppercase Game Code (e.g. TB-7K4P9)
 * Avoiding ambiguous characters like O/0, I/1, S/5
 */
export function generateGameCode(): string {
  const allowedChars = '2346789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * allowedChars.length);
    randomPart += allowedChars[idx];
  }
  return `TB-${randomPart}`;
}

export function validatePlayerName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a player name.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Player name must be at least 2 characters.' };
  }
  if (trimmed.length > 24) {
    return { valid: false, error: 'Player name cannot exceed 24 characters.' };
  }
  // Prevent basic HTML/Script injection
  if (/[<>]/.test(trimmed)) {
    return { valid: false, error: 'Player name contains invalid characters.' };
  }
  return { valid: true };
}

export function validateGameCode(code: string): { valid: boolean; formatted: string; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, formatted: '', error: 'Please enter a Game Code.' };
  }
  let raw = code.toUpperCase().replace(/[\s\-_]+/g, '').trim();
  if (raw.startsWith('TB')) {
    raw = raw.substring(2);
  }
  if (raw.length < 3) {
    return { valid: false, formatted: `TB-${raw}`, error: 'Please enter a valid Game Code (e.g. TB-7K4P9).' };
  }
  const formatted = `TB-${raw}`;
  return { valid: true, formatted };
}

/**
 * Standard Corporate Decision Matrix Scoring Rules
 * - Case 1: Everyone Cooperates -> +3 each
 * - Case 2: Mixed Decisions -> Betrayers get +5, Cooperators get +0
 * - Case 3: Everyone Betrays -> +1 each
 * - Case 4: No decision / timeout -> 0 points
 */
export function calculateRoundScores(
  decisions: { playerId: string; decision: DecisionType }[]
): { [playerId: string]: { points: number; outcome: 'all_cooperate' | 'all_betray' | 'mixed' | 'timeout' } } {
  const result: { [playerId: string]: { points: number; outcome: 'all_cooperate' | 'all_betray' | 'mixed' | 'timeout' } } = {};

  const validDecisions = decisions.filter((d) => d.decision !== 'no_decision');
  const cooperateCount = validDecisions.filter((d) => d.decision === 'cooperate').length;
  const betrayCount = validDecisions.filter((d) => d.decision === 'betray').length;

  decisions.forEach((d) => {
    if (d.decision === 'no_decision') {
      result[d.playerId] = { points: 0, outcome: 'timeout' };
    } else if (betrayCount === 0 && cooperateCount > 0) {
      // Everyone cooperated
      result[d.playerId] = { points: 3, outcome: 'all_cooperate' };
    } else if (cooperateCount === 0 && betrayCount > 0) {
      // Everyone betrayed
      result[d.playerId] = { points: 1, outcome: 'all_betray' };
    } else {
      // Mixed
      const points = d.decision === 'betray' ? 5 : 0;
      result[d.playerId] = { points, outcome: 'mixed' };
    }
  });

  return result;
}

export function compileRoundSummary(
  roundNumber: number,
  players: Player[],
  decisions: Decision[]
): RoundResultSummary {
  const decisionMap = new Map(decisions.map((d) => [d.player_id, d]));
  const scoring = calculateRoundScores(
    players.map((p) => ({
      playerId: p.id,
      decision: decisionMap.get(p.id)?.decision || 'no_decision',
    }))
  );

  let cooperateCount = 0;
  let betrayCount = 0;
  let noDecisionCount = 0;

  const playerResults = players.map((player) => {
    const dec = decisionMap.get(player.id)?.decision || 'no_decision';
    if (dec === 'cooperate') cooperateCount++;
    else if (dec === 'betray') betrayCount++;
    else noDecisionCount++;

    const scoreInfo = scoring[player.id] || { points: 0 };
    const pointsAwarded = decisionMap.get(player.id)?.points ?? scoreInfo.points;

    return {
      player_id: player.id,
      player_name: player.player_name,
      avatar: player.avatar || '🛡️',
      decision: dec,
      points_awarded: pointsAwarded,
      previous_score: player.score - pointsAwarded,
      new_score: player.score,
    };
  });

  let outcomeType: 'all_cooperate' | 'all_betray' | 'mixed' | 'all_timeout' = 'mixed';
  if (betrayCount === 0 && cooperateCount > 0) outcomeType = 'all_cooperate';
  else if (cooperateCount === 0 && betrayCount > 0) outcomeType = 'all_betray';
  else if (cooperateCount === 0 && betrayCount === 0) outcomeType = 'all_timeout';

  return {
    round_number: roundNumber,
    cooperate_count: cooperateCount,
    betray_count: betrayCount,
    no_decision_count: noDecisionCount,
    total_players: players.length,
    outcome_type: outcomeType,
    player_results: playerResults,
  };
}

export function calculateGameStatistics(
  game: Game,
  players: Player[],
  allDecisions: Decision[]
): GameStatistics {
  let totalCooperate = 0;
  let totalBetray = 0;
  let totalNoDec = 0;

  const playerStats: {
    [playerId: string]: { name: string; cooperate: number; betray: number };
  } = {};

  players.forEach((p) => {
    playerStats[p.id] = { name: p.player_name, cooperate: 0, betray: 0 };
  });

  allDecisions.forEach((d) => {
    if (d.decision === 'cooperate') {
      totalCooperate++;
      if (playerStats[d.player_id]) playerStats[d.player_id].cooperate++;
    } else if (d.decision === 'betray') {
      totalBetray++;
      if (playerStats[d.player_id]) playerStats[d.player_id].betray++;
    } else {
      totalNoDec++;
    }
  });

  const totalDecisions = totalCooperate + totalBetray;
  const coopRate = totalDecisions > 0 ? Math.round((totalCooperate / totalDecisions) * 100) : 0;
  const betrayRate = totalDecisions > 0 ? Math.round((totalBetray / totalDecisions) * 100) : 0;

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const highestScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 0;
  const winners = sortedPlayers.filter((p) => p.score === highestScore).map((p) => p.player_name);

  // Most cooperative (highest cooperate rate with min 1)
  let mostCooperative: { name: string; cooperate_count: number; rate: number } | undefined;
  let mostBetraying: { name: string; betray_count: number; rate: number } | undefined;

  let maxCoops = -1;
  let maxBetrays = -1;

  Object.values(playerStats).forEach((p) => {
    const total = p.cooperate + p.betray;
    if (total > 0) {
      if (p.cooperate > maxCoops) {
        maxCoops = p.cooperate;
        mostCooperative = { name: p.name, cooperate_count: p.cooperate, rate: Math.round((p.cooperate / total) * 100) };
      }
      if (p.betray > maxBetrays) {
        maxBetrays = p.betray;
        mostBetraying = { name: p.name, betray_count: p.betray, rate: Math.round((p.betray / total) * 100) };
      }
    }
  });

  return {
    total_rounds_played: game.current_round,
    total_players: players.length,
    total_cooperations: totalCooperate,
    total_betrayals: totalBetray,
    total_no_decisions: totalNoDec,
    cooperation_rate_pct: coopRate,
    betrayal_rate_pct: betrayRate,
    highest_score: highestScore,
    winner_names: winners.length > 0 ? winners : ['No Winner'],
    most_cooperative_player: mostCooperative,
    biggest_betrayer: mostBetraying,
  };
}
