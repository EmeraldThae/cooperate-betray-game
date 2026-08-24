import { Decision, DecisionType, Game, GameStatistics, PairMatchResult, Player, PlayerPairing, Round, RoundResultSummary } from '../types';

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
 * 2-Player Prisoner's Dilemma Outcome Calculator
 * - Both Cooperate: +3 pts each (Mutual Trust)
 * - P1 Betray, P2 Cooperate: P1 +5, P2 +0 (Temptation / Exploitation)
 * - P1 Cooperate, P2 Betray: P1 +0, P2 +5 (Sucker's Payoff)
 * - Both Betray: +1 pt each (Mutual Defection)
 * - Timeout / No Decision: 0 pts for timed out player
 */
export function calculatePairMatchOutcome(
  p1Dec: DecisionType,
  p2Dec: DecisionType
): {
  p1Points: number;
  p2Points: number;
  outcome: 'both_cooperate' | 'both_betray' | 'p1_betray_p2_cooperate' | 'p2_betray_p1_cooperate' | 'timeout' | 'mixed';
  headline: string;
  description: string;
} {
  if (p1Dec === 'no_decision' && p2Dec === 'no_decision') {
    return {
      p1Points: 0,
      p2Points: 0,
      outcome: 'timeout',
      headline: 'Both Timed Out',
      description: 'Neither player submitted a decision in time (0 pts each).',
    };
  }

  if (p1Dec === 'no_decision') {
    return {
      p1Points: 0,
      p2Points: p2Dec === 'cooperate' ? 3 : 5,
      outcome: 'timeout',
      headline: 'Player 1 Timed Out',
      description: 'Player 1 failed to respond. Player 2 gains standard payoff.',
    };
  }

  if (p2Dec === 'no_decision') {
    return {
      p1Points: p1Dec === 'cooperate' ? 3 : 5,
      p2Points: 0,
      outcome: 'timeout',
      headline: 'Player 2 Timed Out',
      description: 'Player 2 failed to respond. Player 1 gains standard payoff.',
    };
  }

  if (p1Dec === 'cooperate' && p2Dec === 'cooperate') {
    return {
      p1Points: 3,
      p2Points: 3,
      outcome: 'both_cooperate',
      headline: 'Mutual Cooperation (+3 pts each)',
      description: 'Both players honored trust, achieving mutual corporate benefit.',
    };
  }

  if (p1Dec === 'betray' && p2Dec === 'cooperate') {
    return {
      p1Points: 5,
      p2Points: 0,
      outcome: 'p1_betray_p2_cooperate',
      headline: 'Player 1 Exploited Trust (+5 / 0 pts)',
      description: 'Player 1 seized advantage by defecting while Player 2 cooperated.',
    };
  }

  if (p1Dec === 'cooperate' && p2Dec === 'betray') {
    return {
      p1Points: 0,
      p2Points: 5,
      outcome: 'p2_betray_p1_cooperate',
      headline: 'Player 2 Exploited Trust (0 / +5 pts)',
      description: 'Player 2 seized advantage by defecting while Player 1 cooperated.',
    };
  }

  // Both Betray
  return {
    p1Points: 1,
    p2Points: 1,
    outcome: 'both_betray',
    headline: 'Mutual Defection / Conflict (+1 pt each)',
    description: 'Both players betrayed each other, receiving minimal deadlock points.',
  };
}

/**
 * Generate randomized 2-player pairings
 */
export function generateRandomPairings(players: Player[], roundNumber: number = 1): PlayerPairing[] {
  if (players.length < 2) return [];

  const shuffled = [...players].sort(() => 0.5 - Math.random());
  const pairings: PlayerPairing[] = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairings.push({
      id: `pair_${roundNumber}_${Math.random().toString(36).substring(2, 8)}`,
      round_number: roundNumber,
      player1_id: shuffled[i].id,
      player2_id: shuffled[i + 1].id,
    });
  }

  // If odd number, pair the remaining player with the first player or create a bye
  if (shuffled.length % 2 !== 0 && shuffled.length >= 3) {
    const oddPlayer = shuffled[shuffled.length - 1];
    pairings.push({
      id: `pair_${roundNumber}_odd_${Math.random().toString(36).substring(2, 8)}`,
      round_number: roundNumber,
      player1_id: oddPlayer.id,
      player2_id: shuffled[0].id,
    });
  }

  return pairings;
}

/**
 * Helper to find a specific player's 1v1 opponent from the active pairings
 */
export function findPlayerOpponent(
  playerId: string,
  pairings: PlayerPairing[] = [],
  players: Player[] = []
): { opponent: Player | null; pairing: PlayerPairing | null; isPlayer1: boolean } {
  if (!pairings || pairings.length === 0) {
    // If only 2 players exist in total and no pairings, fallback to the other player
    if (players.length === 2) {
      const other = players.find((p) => p.id !== playerId) || null;
      return {
        opponent: other,
        pairing: null,
        isPlayer1: players[0]?.id === playerId,
      };
    }
    return { opponent: null, pairing: null, isPlayer1: true };
  }

  for (const pair of pairings) {
    if (pair.player1_id === playerId) {
      const opp = players.find((p) => p.id === pair.player2_id) || null;
      return { opponent: opp, pairing: pair, isPlayer1: true };
    }
    if (pair.player2_id === playerId) {
      const opp = players.find((p) => p.id === pair.player1_id) || null;
      return { opponent: opp, pairing: pair, isPlayer1: false };
    }
  }

  // Fallback if 2 players in room
  if (players.length === 2) {
    const other = players.find((p) => p.id !== playerId) || null;
    return { opponent: other, pairing: null, isPlayer1: players[0]?.id === playerId };
  }

  return { opponent: null, pairing: null, isPlayer1: true };
}

/**
 * Compile detailed 2-Player Match Results for the entire room
 */
export function getPairMatchResults(
  roundNumber: number,
  pairings: PlayerPairing[] = [],
  players: Player[] = [],
  decisions: Decision[] = []
): PairMatchResult[] {
  const decMap = new Map(decisions.map((d) => [d.player_id, d]));
  const pMap = new Map(players.map((p) => [p.id, p]));

  // If no explicit pairings saved, synthesize default 2-player pairs
  let effectivePairings = [...pairings];
  if (effectivePairings.length === 0 && players.length >= 2) {
    for (let i = 0; i < players.length - 1; i += 2) {
      effectivePairings.push({
        id: `synth_pair_${i}`,
        round_number: roundNumber,
        player1_id: players[i].id,
        player2_id: players[i + 1].id,
      });
    }
  }

  return effectivePairings.map((pair) => {
    const p1 = pMap.get(pair.player1_id) || { id: pair.player1_id, player_name: 'Player 1', avatar: '🛡️', score: 0 };
    const p2 = pMap.get(pair.player2_id) || { id: pair.player2_id, player_name: 'Player 2', avatar: '⚡', score: 0 };

    const dec1 = decMap.get(pair.player1_id)?.decision || 'no_decision';
    const dec2 = decMap.get(pair.player2_id)?.decision || 'no_decision';

    const calc = calculatePairMatchOutcome(dec1, dec2);
    const pts1 = decMap.get(pair.player1_id)?.points ?? calc.p1Points;
    const pts2 = decMap.get(pair.player2_id)?.points ?? calc.p2Points;

    return {
      pairing_id: pair.id,
      round_number: roundNumber,
      player1: {
        id: p1.id,
        name: p1.player_name,
        avatar: p1.avatar,
        decision: dec1,
        points: pts1,
        score: p1.score,
      },
      player2: {
        id: p2.id,
        name: p2.player_name,
        avatar: p2.avatar,
        decision: dec2,
        points: pts2,
        score: p2.score,
      },
      outcome: calc.outcome,
      headline: calc.headline,
      description: calc.description,
    };
  });
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

export interface RoundGroupPairMatch {
  roundNumber: number;
  pairId: string;
  player1: {
    id: string;
    name: string;
    avatar: string;
    decision: DecisionType;
    points: number;
  };
  player2: {
    id: string;
    name: string;
    avatar: string;
    decision: DecisionType;
    points: number;
  };
  outcome: 'both_cooperate' | 'both_betray' | 'p1_betray_p2_cooperate' | 'p2_betray_p1_cooperate' | 'timeout' | 'mixed';
  headline: string;
  description: string;
}

export interface GroupTournamentAnalysis {
  roundMatches: { [roundNumber: number]: RoundGroupPairMatch[] };
  pairSummaries: {
    pairKey: string;
    player1: Player;
    player2: Player;
    matchesPlayed: number;
    mutualCooperations: number;
    mutualBetrayals: number;
    p1BetrayCount: number;
    p2BetrayCount: number;
    combinedPoints: number;
    synergyType: 'Mutual Trust 🤝' | 'Mutual Defection 🔒' | 'Exploitative ⚡' | 'Balanced Strategy ⚖️';
  }[];
  totalGroupMatches: number;
  totalMutualCooperations: number;
  totalMutualBetrayals: number;
  totalExploitations: number;
}

export function calculateGroupTournamentAnalysis(
  game: Game,
  players: Player[],
  rounds: Round[],
  allDecisions: Decision[]
): GroupTournamentAnalysis {
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const roundMatches: { [roundNumber: number]: RoundGroupPairMatch[] } = {};
  
  const pairAggregates = new Map<string, {
    p1: Player;
    p2: Player;
    matches: number;
    mutualCoop: number;
    mutualBetray: number;
    p1Betray: number;
    p2Betray: number;
    p1Pts: number;
    p2Pts: number;
  }>();

  let totalGroupMatches = 0;
  let totalMutualCooperations = 0;
  let totalMutualBetrayals = 0;
  let totalExploitations = 0;

  // Process rounds
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);

  // If no rounds in array but game has current_round, synthesize rounds 1 to current_round
  const maxRound = Math.max(game.current_round || 0, sortedRounds.length);
  const targetRounds: { round_number: number; pairings: PlayerPairing[]; id: string }[] = [];

  for (let rNum = 1; rNum <= maxRound; rNum++) {
    const existing = sortedRounds.find((r) => r.round_number === rNum);
    if (existing) {
      targetRounds.push({
        round_number: rNum,
        pairings: existing.pairings || game.current_pairings || generateRandomPairings(players, rNum),
        id: existing.id,
      });
    } else {
      targetRounds.push({
        round_number: rNum,
        pairings: game.current_pairings || generateRandomPairings(players, rNum),
        id: `synth_round_${rNum}`,
      });
    }
  }

  targetRounds.forEach((roundObj) => {
    const rNum = roundObj.round_number;
    const pairings = roundObj.pairings || [];
    roundMatches[rNum] = [];

    pairings.forEach((pair, idx) => {
      const p1 = playerMap.get(pair.player1_id) || { id: pair.player1_id, player_name: 'Player 1', avatar: '🛡️', score: 0 } as Player;
      const p2 = playerMap.get(pair.player2_id) || { id: pair.player2_id, player_name: 'Player 2', avatar: '⚡', score: 0 } as Player;

      // Find decisions for round
      const dec1 = allDecisions.find((d) => (d.round_id === roundObj.id || !d.round_id) && d.player_id === p1.id)?.decision || 'cooperate';
      const dec2 = allDecisions.find((d) => (d.round_id === roundObj.id || !d.round_id) && d.player_id === p2.id)?.decision || 'cooperate';

      const outcomeCalc = calculatePairMatchOutcome(dec1, dec2);

      const matchResult: RoundGroupPairMatch = {
        roundNumber: rNum,
        pairId: pair.id || `pair_${rNum}_${idx}`,
        player1: {
          id: p1.id,
          name: p1.player_name,
          avatar: p1.avatar || '🛡️',
          decision: dec1,
          points: outcomeCalc.p1Points,
        },
        player2: {
          id: p2.id,
          name: p2.player_name,
          avatar: p2.avatar || '⚡',
          decision: dec2,
          points: outcomeCalc.p2Points,
        },
        outcome: outcomeCalc.outcome,
        headline: outcomeCalc.headline,
        description: outcomeCalc.description,
      };

      roundMatches[rNum].push(matchResult);
      totalGroupMatches++;

      if (outcomeCalc.outcome === 'both_cooperate') totalMutualCooperations++;
      else if (outcomeCalc.outcome === 'both_betray') totalMutualBetrayals++;
      else if (outcomeCalc.outcome === 'p1_betray_p2_cooperate' || outcomeCalc.outcome === 'p2_betray_p1_cooperate') totalExploitations++;

      // Aggregate pairwise stats
      const pairKey = [p1.id, p2.id].sort().join(':::');
      const isP1First = p1.id < p2.id;
      const aggP1 = isP1First ? p1 : p2;
      const aggP2 = isP1First ? p2 : p1;
      const aggDec1 = isP1First ? dec1 : dec2;
      const aggDec2 = isP1First ? dec2 : dec1;
      const aggPts1 = isP1First ? outcomeCalc.p1Points : outcomeCalc.p2Points;
      const aggPts2 = isP1First ? outcomeCalc.p2Points : outcomeCalc.p1Points;

      if (!pairAggregates.has(pairKey)) {
        pairAggregates.set(pairKey, {
          p1: aggP1,
          p2: aggP2,
          matches: 0,
          mutualCoop: 0,
          mutualBetray: 0,
          p1Betray: 0,
          p2Betray: 0,
          p1Pts: 0,
          p2Pts: 0,
        });
      }

      const agg = pairAggregates.get(pairKey)!;
      agg.matches++;
      agg.p1Pts += aggPts1;
      agg.p2Pts += aggPts2;
      if (aggDec1 === 'cooperate' && aggDec2 === 'cooperate') agg.mutualCoop++;
      else if (aggDec1 === 'betray' && aggDec2 === 'betray') agg.mutualBetray++;
      else if (aggDec1 === 'betray' && aggDec2 === 'cooperate') agg.p1Betray++;
      else if (aggDec1 === 'cooperate' && aggDec2 === 'betray') agg.p2Betray++;
    });
  });

  const pairSummaries = Array.from(pairAggregates.entries()).map(([pairKey, agg]) => {
    let synergyType: 'Mutual Trust 🤝' | 'Mutual Defection 🔒' | 'Exploitative ⚡' | 'Balanced Strategy ⚖️' = 'Balanced Strategy ⚖️';
    if (agg.mutualCoop > 0 && agg.mutualCoop >= agg.matches * 0.7) {
      synergyType = 'Mutual Trust 🤝';
    } else if (agg.mutualBetray > 0 && agg.mutualBetray >= agg.matches * 0.5) {
      synergyType = 'Mutual Defection 🔒';
    } else if (agg.p1Betray > 0 || agg.p2Betray > 0) {
      synergyType = 'Exploitative ⚡';
    }

    return {
      pairKey,
      player1: agg.p1,
      player2: agg.p2,
      matchesPlayed: agg.matches,
      mutualCooperations: agg.mutualCoop,
      mutualBetrayals: agg.mutualBetray,
      p1BetrayCount: agg.p1Betray,
      p2BetrayCount: agg.p2Betray,
      combinedPoints: agg.p1Pts + agg.p2Pts,
      synergyType,
    };
  });

  return {
    roundMatches,
    pairSummaries,
    totalGroupMatches,
    totalMutualCooperations,
    totalMutualBetrayals,
    totalExploitations,
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

export interface IndividualPlayerDuel {
  roundNumber: number;
  opponent: Player | null;
  myDecision: DecisionType;
  opponentDecision: DecisionType;
  myPoints: number;
  opponentPoints: number;
  winner: 'you' | 'opponent' | 'tie';
  outcome: 'both_cooperate' | 'both_betray' | 'p1_betray_p2_cooperate' | 'p2_betray_p1_cooperate' | 'timeout' | 'mixed';
  headline: string;
  description: string;
}

export interface IndividualPlayerAnalysis {
  player: Player;
  duels: IndividualPlayerDuel[];
  primaryOpponent: Player | null;
  totalMyPoints: number;
  totalOpponentPoints: number;
  duelsWon: number;
  duelsLost: number;
  duelsTied: number;
  overallWinner: 'you' | 'opponent' | 'tie';
  myCooperations: number;
  myBetrayals: number;
  oppCooperations: number;
  oppBetrayals: number;
  mutualCooperations: number;
  mutualBetrayals: number;
}

/**
 * Compile strictly 1-on-1 head-to-head match outcomes for an individual player
 */
export function calculateIndividualPlayerAnalysis(
  playerId: string,
  game: Game,
  players: Player[],
  allRounds: Round[] = [],
  allDecisions: Decision[] = []
): IndividualPlayerAnalysis {
  const self = players.find((p) => p.id === playerId) || {
    id: playerId,
    game_id: game.id,
    user_id: 'unknown',
    player_name: 'You',
    score: 0,
    status: 'waiting',
    avatar: '🛡️',
    joined_at: '',
    last_seen_at: '',
  };

  const duels: IndividualPlayerDuel[] = [];
  const opponentOccurrences = new Map<string, number>();

  let totalMyPoints = 0;
  let totalOpponentPoints = 0;
  let duelsWon = 0;
  let duelsLost = 0;
  let duelsTied = 0;
  let myCooperations = 0;
  let myBetrayals = 0;
  let oppCooperations = 0;
  let oppBetrayals = 0;
  let mutualCooperations = 0;
  let mutualBetrayals = 0;

  // Process each round in chronological order
  const roundsToProcess = [...allRounds].sort((a, b) => a.round_number - b.round_number);

  // If no round records exist, create a baseline for completed rounds
  if (roundsToProcess.length === 0 && game.current_round > 0) {
    for (let r = 1; r <= game.current_round; r++) {
      roundsToProcess.push({
        id: `r_${r}`,
        game_id: game.id,
        round_number: r,
        status: 'revealed',
        started_at: '',
        pairings: game.current_pairings || [],
      });
    }
  }

  roundsToProcess.forEach((round) => {
    const pairings = round.pairings || game.current_pairings || [];
    const { opponent, isPlayer1 } = findPlayerOpponent(self.id, pairings, players);

    if (opponent) {
      opponentOccurrences.set(opponent.id, (opponentOccurrences.get(opponent.id) || 0) + 1);
    }

    const roundDecisions = allDecisions.filter((d) => d.round_id === round.id);
    const myDecRec = roundDecisions.find((d) => d.player_id === self.id);
    const oppDecRec = opponent ? roundDecisions.find((d) => d.player_id === opponent.id) : null;

    const myDec = myDecRec?.decision || 'no_decision';
    const oppDec = oppDecRec?.decision || 'no_decision';

    const outcomeCalc = calculatePairMatchOutcome(
      isPlayer1 ? myDec : oppDec,
      isPlayer1 ? oppDec : myDec
    );

    const myPts = isPlayer1 ? outcomeCalc.p1Points : outcomeCalc.p2Points;
    const oppPts = isPlayer1 ? outcomeCalc.p2Points : outcomeCalc.p1Points;

    totalMyPoints += myPts;
    totalOpponentPoints += oppPts;

    let winner: 'you' | 'opponent' | 'tie' = 'tie';
    if (myPts > oppPts) {
      winner = 'you';
      duelsWon++;
    } else if (oppPts > myPts) {
      winner = 'opponent';
      duelsLost++;
    } else {
      winner = 'tie';
      duelsTied++;
    }

    if (myDec === 'cooperate') myCooperations++;
    if (myDec === 'betray') myBetrayals++;
    if (oppDec === 'cooperate') oppCooperations++;
    if (oppDec === 'betray') oppBetrayals++;

    if (myDec === 'cooperate' && oppDec === 'cooperate') mutualCooperations++;
    if (myDec === 'betray' && oppDec === 'betray') mutualBetrayals++;

    duels.push({
      roundNumber: round.round_number,
      opponent,
      myDecision: myDec,
      opponentDecision: oppDec,
      myPoints: myPts,
      opponentPoints: oppPts,
      winner,
      outcome: outcomeCalc.outcome,
      headline: outcomeCalc.headline,
      description: outcomeCalc.description,
    });
  });

  // Find most frequent opponent
  let primaryOpponent: Player | null = null;
  let maxCount = 0;
  for (const [oppId, count] of opponentOccurrences.entries()) {
    if (count > maxCount) {
      maxCount = count;
      primaryOpponent = players.find((p) => p.id === oppId) || null;
    }
  }

  // Fallback if not found and 2 players in room
  if (!primaryOpponent && players.length === 2) {
    primaryOpponent = players.find((p) => p.id !== self.id) || null;
  }

  let overallWinner: 'you' | 'opponent' | 'tie' = 'tie';
  if (totalMyPoints > totalOpponentPoints) {
    overallWinner = 'you';
  } else if (totalOpponentPoints > totalMyPoints) {
    overallWinner = 'opponent';
  } else {
    overallWinner = 'tie';
  }

  return {
    player: self,
    duels,
    primaryOpponent,
    totalMyPoints,
    totalOpponentPoints,
    duelsWon,
    duelsLost,
    duelsTied,
    overallWinner,
    myCooperations,
    myBetrayals,
    oppCooperations,
    oppBetrayals,
    mutualCooperations,
    mutualBetrayals,
  };
}
