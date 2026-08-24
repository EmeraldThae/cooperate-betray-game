import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Game, Player, Decision, Round } from '../types';
import {
  calculateGameStatistics,
  calculateGroupTournamentAnalysis,
  calculateIndividualPlayerAnalysis,
} from '../utils/gameLogic';
import {
  Trophy,
  Award,
  Shield,
  Zap,
  RotateCcw,
  Download,
  Users,
  BarChart3,
  Sparkles,
  Layers,
  Swords,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Handshake,
  Crown,
  Home,
} from 'lucide-react';
import { Leaderboard } from '../components/Leaderboard';
import { playSound } from '../utils/audio';

interface FinalSummaryProps {
  game: Game;
  players: Player[];
  allRounds?: Round[];
  allDecisions?: Decision[];
  role: 'host' | 'player';
  currentPlayerId?: string;
  onResetGame: () => void;
  onHome: () => void;
}

export const FinalSummary: React.FC<FinalSummaryProps> = ({
  game,
  players,
  allRounds = [],
  allDecisions = [],
  role,
  currentPlayerId,
  onResetGame,
  onHome,
}) => {
  const [activeHostTab, setActiveHostTab] = useState<'standings' | 'all_pairs' | 'dynamics' | 'debrief'>('standings');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number | 'all'>('all');

  // Calculations for Host (full group) vs Individual Player (strictly 1v1)
  const stats = calculateGameStatistics(game, players, allDecisions);
  const groupAnalysis = calculateGroupTournamentAnalysis(game, players, allRounds, allDecisions);

  const playerAnalysis = currentPlayerId
    ? calculateIndividualPlayerAnalysis(currentPlayerId, game, players, allRounds, allDecisions)
    : null;

  useEffect(() => {
    playSound('victory');
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (e) {}
  }, []);

  const handleExportCsv = () => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    
    // 1. Group Standings Section
    let csv = '=== GROUP TOURNAMENT STANDINGS ===\n';
    csv += 'Rank,Player Name,Total Score,Status\n';
    sorted.forEach((p, idx) => {
      csv += `${idx + 1},"${p.player_name}",${p.score},${p.status}\n`;
    });

    // 2. Group Pair Matchups Section
    csv += '\n=== GROUP PAIR MATCHUP RESULTS (ALL ROUNDS) ===\n';
    csv += 'Round,Player 1,P1 Decision,P1 Points,Player 2,P2 Decision,P2 Points,Outcome Headline\n';
    
    Object.entries(groupAnalysis.roundMatches).forEach(([roundNum, matches]) => {
      matches.forEach((m) => {
        csv += `${roundNum},"${m.player1.name}",${m.player1.decision},${m.player1.points},"${m.player2.name}",${m.player2.decision},${m.player2.points},"${m.headline}"\n`;
      });
    });

    // 3. Pair Synergy Section
    csv += '\n=== PAIR HEAD-TO-HEAD SYNERGY SUMMARY ===\n';
    csv += 'Player 1,Player 2,Matches Played,Mutual Cooperations,Mutual Betrayals,Combined Points,Synergy Classification\n';
    groupAnalysis.pairSummaries.forEach((ps) => {
      csv += `"${ps.player1.player_name}","${ps.player2.player_name}",${ps.matchesPlayed},${ps.mutualCooperations},${ps.mutualBetrayals},${ps.combinedPoints},"${ps.synergyType}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cooperate_Betray_${game.game_code}_Tournament_Report.csv`;
    link.click();
  };

  // Filtered round numbers for host group view
  const roundNumbers = Object.keys(groupAnalysis.roundMatches)
    .map(Number)
    .sort((a, b) => a - b);

  const displayedRounds = selectedRoundFilter === 'all'
    ? roundNumbers
    : roundNumbers.filter((r) => r === selectedRoundFilter);

  // Host Winners Calculations: Individual Winner(s) & Pair Group Winner(s)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const highestIndividualScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 0;
  const individualWinners = sortedPlayers.filter((p) => p.score === highestIndividualScore);

  const sortedPairs = [...groupAnalysis.pairSummaries].sort((a, b) => {
    if (b.combinedPoints !== a.combinedPoints) {
      return b.combinedPoints - a.combinedPoints;
    }
    return b.mutualCooperations - a.mutualCooperations;
  });
  const highestPairScore = sortedPairs.length > 0 ? sortedPairs[0].combinedPoints : 0;
  const pairWinners = sortedPairs.filter((p) => p.combinedPoints === highestPairScore && p.combinedPoints > 0);
  const primaryPairWinner = sortedPairs.length > 0 ? sortedPairs[0] : null;

  // ==========================================
  // VIEW 1: INDIVIDUAL PLAYER RESULT VIEW
  // (Strictly displays the winner between the 2 paired players, no other players' scores)
  // ==========================================
  if (role === 'player' && playerAnalysis) {
    const {
      player,
      primaryOpponent,
      duels,
      totalMyPoints,
      totalOpponentPoints,
      duelsWon,
      duelsLost,
      duelsTied,
      overallWinner,
      myCooperations,
      myBetrayals,
      mutualCooperations,
    } = playerAnalysis;

    const opponentName = primaryOpponent?.player_name || 'Opponent';

    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-fade-in">
        {/* 1. Individual 1v1 Duel Winner Spotlight Header */}
        <div
          className={`p-8 md:p-12 rounded-3xl border shadow-2xl text-center space-y-5 relative overflow-hidden ${
            overallWinner === 'you'
              ? 'bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/50'
              : overallWinner === 'opponent'
              ? 'bg-gradient-to-b from-rose-950/80 via-slate-900 to-slate-950 border-rose-500/50'
              : 'bg-gradient-to-b from-indigo-950/80 via-slate-900 to-slate-950 border-indigo-500/50'
          }`}
        >
          {/* Winner Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/90 border border-slate-800 text-xs font-black tracking-wider uppercase">
            {overallWinner === 'you' ? (
              <>
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-emerald-400">1-ON-1 DUEL WINNER: YOU</span>
              </>
            ) : overallWinner === 'opponent' ? (
              <>
                <Zap className="w-4 h-4 text-rose-400" />
                <span className="text-rose-400">1-ON-1 DUEL WINNER: {opponentName}</span>
              </>
            ) : (
              <>
                <Handshake className="w-4 h-4 text-indigo-400" />
                <span className="text-indigo-300">1-ON-1 DUEL: DRAW</span>
              </>
            )}
          </div>

          {/* Big Headline */}
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            {overallWinner === 'you'
              ? 'YOU WON THE DUEL!'
              : overallWinner === 'opponent'
              ? `${opponentName.toUpperCase()} WON THE DUEL`
              : 'THE DUEL ENDED IN A DRAW'}
          </h1>

          {/* Side-by-Side Total Score Board */}
          <div className="grid grid-cols-5 items-center gap-2 md:gap-4 max-w-lg mx-auto py-2">
            {/* You */}
            <div
              className={`col-span-2 p-4 rounded-2xl border text-center space-y-1.5 ${
                overallWinner === 'you'
                  ? 'bg-emerald-950/50 border-emerald-500/50 ring-2 ring-emerald-500/30'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <div className="text-3xl md:text-4xl">{player.avatar || '🛡️'}</div>
              <div className="text-xs font-bold text-white truncate">{player.player_name}</div>
              <div className="text-[10px] uppercase font-black text-indigo-300 tracking-wider">YOU</div>
              <div className="font-mono text-2xl md:text-3xl font-black text-emerald-400">
                {totalMyPoints} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
            </div>

            {/* VS */}
            <div className="col-span-1 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-rose-400 shadow-md">
                VS
              </div>
            </div>

            {/* Opponent */}
            <div
              className={`col-span-2 p-4 rounded-2xl border text-center space-y-1.5 ${
                overallWinner === 'opponent'
                  ? 'bg-rose-950/50 border-rose-500/50 ring-2 ring-rose-500/30'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <div className="text-3xl md:text-4xl">{primaryOpponent?.avatar || '⚡'}</div>
              <div className="text-xs font-bold text-white truncate">{opponentName}</div>
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">OPPONENT</div>
              <div className="font-mono text-2xl md:text-3xl font-black text-amber-400">
                {totalOpponentPoints} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
            </div>
          </div>

          <p className="text-xs md:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            {overallWinner === 'you'
              ? `You outperformed ${opponentName} with a final score of ${totalMyPoints} pts vs ${totalOpponentPoints} pts (${duelsWon} round wins, ${duelsTied} draws, ${duelsLost} losses).`
              : overallWinner === 'opponent'
              ? `${opponentName} took the victory with ${totalOpponentPoints} pts vs your ${totalMyPoints} pts (${duelsLost} round wins for opponent, ${duelsWon} for you).`
              : `Both players finished evenly matched with ${totalMyPoints} pts across all completed rounds.`}
          </p>
        </div>

        {/* 2. 1-on-1 Head-to-Head Duel Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="p-4 md:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] md:text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-emerald-400" /> Your Round Wins
            </div>
            <div className="font-mono text-2xl md:text-3xl font-black text-emerald-400">
              {duelsWon}
            </div>
            <div className="text-[10px] md:text-[11px] text-slate-400">
              Out of {duels.length} rounds played
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] md:text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-rose-400" /> Opponent Wins
            </div>
            <div className="font-mono text-2xl md:text-3xl font-black text-rose-400">
              {duelsLost}
            </div>
            <div className="text-[10px] md:text-[11px] text-slate-400">
              Won by {opponentName}
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] md:text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Handshake className="w-3.5 h-3.5 text-indigo-400" /> Mutual Trust
            </div>
            <div className="font-mono text-2xl md:text-3xl font-black text-indigo-400">
              {mutualCooperations}
            </div>
            <div className="text-[10px] md:text-[11px] text-slate-400">
              Both Cooperated (+3/+3)
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
            <div className="text-[10px] md:text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" /> Your Strategy
            </div>
            <div className="font-mono text-base md:text-lg font-black text-amber-400 pt-1">
              {myCooperations} Coop / {myBetrayals} Betray
            </div>
            <div className="text-[10px] md:text-[11px] text-slate-400">
              Your decision pattern
            </div>
          </div>
        </div>

        {/* 3. Round-by-Round Breakdown strictly between You & Your Opponent */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base md:text-lg font-black text-white">
                Round-by-Round 1v1 Duel History
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              You vs {opponentName}
            </span>
          </div>

          <div className="space-y-3">
            {duels.map((duel) => {
              return (
                <div
                  key={duel.roundNumber}
                  className={`p-4 rounded-2xl border transition-all ${
                    duel.winner === 'you'
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : duel.winner === 'opponent'
                      ? 'bg-rose-950/30 border-rose-500/40'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  {/* Round Header & Outcome Tag */}
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        R{duel.roundNumber}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                          duel.winner === 'you'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                            : duel.winner === 'opponent'
                            ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                            : 'bg-indigo-950 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        {duel.winner === 'you'
                          ? `You Won (+${duel.myPoints} vs +${duel.opponentPoints})`
                          : duel.winner === 'opponent'
                          ? `${opponentName} Won (+${duel.opponentPoints} vs +${duel.myPoints})`
                          : `Tied Matchup (+${duel.myPoints} each)`}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      {duel.headline}
                    </span>
                  </div>

                  {/* 2-Player Side by Side */}
                  <div className="grid grid-cols-5 items-center gap-2">
                    {/* You */}
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-lg">{player.avatar || '🛡️'}</span>
                        <span className="text-xs font-bold text-white truncate">
                          {player.player_name} (You)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            duel.myDecision === 'cooperate'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : duel.myDecision === 'betray'
                              ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {duel.myDecision}
                        </span>
                        <span className="font-mono text-xs font-black text-emerald-400">
                          +{duel.myPoints} pts
                        </span>
                      </div>
                    </div>

                    {/* VS */}
                    <div className="col-span-1 text-center font-bold text-[10px] text-slate-400 uppercase">
                      vs
                    </div>

                    {/* Opponent */}
                    <div className="col-span-2 space-y-1 text-right">
                      <div className="flex items-center justify-end gap-1.5 truncate">
                        <span className="text-xs font-bold text-white truncate">
                          {opponentName}
                        </span>
                        <span className="text-lg">{primaryOpponent?.avatar || '⚡'}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono text-xs font-black text-amber-400">
                          +{duel.opponentPoints} pts
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            duel.opponentDecision === 'cooperate'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : duel.opponentDecision === 'betray'
                              ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {duel.opponentDecision}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: HOST TOURNAMENT RESULT VIEW
  // (Full room winner, team statistics, group pair matchups, and debrief guide)
  // ==========================================
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-fade-in">
      {/* 1. Host Group Winner Spotlight Header: Individual Winner & Pair Group Winner */}
      <div className="p-6 md:p-10 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Header Label */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs font-black text-amber-300 uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>TOURNAMENT CONCLUDED &bull; {game.total_rounds} ROUNDS PLAYED</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
            TOURNAMENT CHAMPIONS
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto">
            Official strategic outcomes across {players.length} players and {groupAnalysis.totalGroupMatches} breakout duels.
          </p>
        </div>

        {/* Dual Winner Spotlight Cards (Individual Winner & Pair Group Winner) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* CARD A: INDIVIDUAL WINNER */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/40 shadow-xl space-y-4 relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>INDIVIDUAL WINNER</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-amber-500/30">
                Top Score
              </span>
            </div>

            <div className="space-y-3 py-2 text-center">
              {individualWinners.length === 1 ? (
                <>
                  <div className="text-5xl">{individualWinners[0].avatar || '👑'}</div>
                  <div>
                    <h3 className="text-2xl font-black text-white">
                      {individualWinners[0].player_name}
                    </h3>
                    <div className="font-mono text-3xl font-black text-amber-400 mt-1">
                      {individualWinners[0].score} <span className="text-sm font-normal text-slate-400">pts</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 text-4xl">
                    {individualWinners.map((w) => (
                      <span key={w.id}>{w.avatar || '👑'}</span>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                      Co-Champions Tied
                    </div>
                    <h3 className="text-xl font-black text-white">
                      {individualWinners.map((w) => w.player_name).join(' & ')}
                    </h3>
                    <div className="font-mono text-3xl font-black text-amber-400 mt-1">
                      {highestIndividualScore} <span className="text-sm font-normal text-slate-400">pts each</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
              Highest individual point total scored across all tournament rounds.
            </div>
          </div>

          {/* CARD B: PAIR GROUP WINNER */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/40 shadow-xl space-y-4 relative flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-black uppercase tracking-wider">
                <Handshake className="w-4 h-4 text-emerald-400" />
                <span>PAIR GROUP WINNER</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/30">
                Top Duo
              </span>
            </div>

            <div className="space-y-3 py-2 text-center">
              {primaryPairWinner ? (
                <>
                  <div className="flex items-center justify-center gap-3 text-4xl">
                    <span>{primaryPairWinner.player1.avatar || '🛡️'}</span>
                    <span className="text-xl text-slate-400 font-bold">&</span>
                    <span>{primaryPairWinner.player2.avatar || '⚡'}</span>
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-white">
                      {primaryPairWinner.player1.player_name} & {primaryPairWinner.player2.player_name}
                    </h3>
                    <div className="font-mono text-3xl font-black text-emerald-400 mt-1">
                      {primaryPairWinner.combinedPoints} <span className="text-sm font-normal text-slate-400">combined pts</span>
                    </div>
                    <div className="text-xs text-emerald-300 font-semibold mt-1">
                      {primaryPairWinner.synergyType} &bull; {primaryPairWinner.mutualCooperations} Mutual Trust Duels
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-slate-400 text-sm">
                  Single player session (Pair results recorded for 2+ players)
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
              Highest collective scoring and most cooperative duo pairing in the tournament.
            </div>
          </div>
        </div>

        {/* Host Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-800/80">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-2 transition"
            id="btn-export-csv"
          >
            <Download className="w-4 h-4 text-indigo-400" /> Export Full Tournament CSV
          </button>

          <button
            onClick={onResetGame}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            id="btn-host-reset-game"
          >
            <RotateCcw className="w-4 h-4" /> Start New Session
          </button>

          <button
            onClick={onHome}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
            id="btn-return-home"
          >
            Return to Home
          </button>
        </div>
      </div>

      {/* 2. Team Behavioral Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cooperation Index */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Team Cooperation
          </div>
          <div className="font-mono text-3xl font-black text-emerald-400">
            {stats.cooperation_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.total_cooperations} Cooperate choices
          </div>
        </div>

        {/* Defection Rate */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-rose-400" /> Defection Rate
          </div>
          <div className="font-mono text-3xl font-black text-rose-400">
            {stats.betrayal_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.total_betrayals} Betray choices
          </div>
        </div>

        {/* Mutual Trust Matches */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Handshake className="w-3.5 h-3.5 text-indigo-400" /> Mutual Trust Duels
          </div>
          <div className="font-mono text-3xl font-black text-indigo-400">
            {groupAnalysis.totalMutualCooperations}
          </div>
          <div className="text-[11px] text-slate-400">
            Both players cooperated (+3/+3)
          </div>
        </div>

        {/* Exploitative Duels */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Exploited Duels
          </div>
          <div className="font-mono text-3xl font-black text-amber-400">
            {groupAnalysis.totalExploitations}
          </div>
          <div className="text-[11px] text-slate-400">
            One betrayed while other cooperated (+5/0)
          </div>
        </div>
      </div>

      {/* 3. Host Navigation Tabs */}
      <div className="flex items-center justify-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveHostTab('standings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeHostTab === 'standings'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-standings"
        >
          <Trophy className="w-4 h-4" />
          <span>Group Standings & Podium</span>
        </button>

        <button
          onClick={() => setActiveHostTab('all_pairs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeHostTab === 'all_pairs'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-all-pairs"
        >
          <Layers className="w-4 h-4" />
          <span>All Group Pair Matchups ({groupAnalysis.totalGroupMatches} Duels)</span>
        </button>

        <button
          onClick={() => setActiveHostTab('dynamics')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeHostTab === 'dynamics'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-dynamics"
        >
          <Handshake className="w-4 h-4" />
          <span>Room Pair Synergy & Trust</span>
        </button>

        <button
          onClick={() => setActiveHostTab('debrief')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeHostTab === 'debrief'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-debrief"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Workshop Debrief Guide</span>
        </button>
      </div>

      {/* 4. Host Tab Contents */}

      {/* TAB 1: GROUP STANDINGS */}
      {activeHostTab === 'standings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          <div className="lg:col-span-8">
            <Leaderboard
              players={players}
              isFinal={true}
            />
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Strategic Highlights
              </h3>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Group Cooperation Anchor
                </div>
                <div className="font-bold text-base text-white">
                  {stats.most_cooperative_player?.name || 'Everyone'}
                </div>
                <div className="text-xs text-slate-400">
                  {stats.most_cooperative_player
                    ? `${stats.most_cooperative_player.cooperate_count} Cooperations (${stats.most_cooperative_player.rate}%)`
                    : 'Balanced play across the room'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Group Risk Defector
                </div>
                <div className="font-bold text-base text-white">
                  {stats.biggest_betrayer?.name || 'None'}
                </div>
                <div className="text-xs text-slate-400">
                  {stats.biggest_betrayer
                    ? `${stats.biggest_betrayer.betray_count} Betrayals (${stats.biggest_betrayer.rate}%)`
                    : 'Zero betrayals observed'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL GROUP PAIR RESULTS */}
      {activeHostTab === 'all_pairs' && (
        <div className="space-y-6 animate-fade-in">
          {/* Round Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span>Filter by Round:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedRoundFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedRoundFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Rounds ({roundNumbers.length})
              </button>

              {roundNumbers.map((rNum) => (
                <button
                  key={rNum}
                  onClick={() => setSelectedRoundFilter(rNum)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedRoundFilter === rNum
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Round {rNum}
                </button>
              ))}
            </div>
          </div>

          {/* Render Round Matchups */}
          {displayedRounds.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-3xl">
              No pair matchups recorded for this round.
            </div>
          ) : (
            displayedRounds.map((rNum) => {
              const matches = groupAnalysis.roundMatches[rNum] || [];
              return (
                <div
                  key={rNum}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-mono font-black text-xs">
                        R{rNum}
                      </span>
                      <h3 className="text-base font-black text-white">
                        Round {rNum} Group Matchups
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">
                        ({matches.length} {matches.length === 1 ? 'Pair' : 'Pairs'})
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      Breakout Duels
                    </span>
                  </div>

                  {/* Grid of 2-player matches for this round */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches.map((m) => {
                      return (
                        <div
                          key={m.pairId}
                          className="p-4 rounded-2xl border bg-slate-950/80 border-slate-800 hover:border-slate-700 transition-all"
                        >
                          {/* Top Outcome Badge */}
                          <div className="flex items-center justify-between mb-3 text-xs">
                            <span
                              className={`font-bold px-2.5 py-0.5 rounded-lg border text-[11px] ${
                                m.outcome === 'both_cooperate'
                                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                                  : m.outcome === 'both_betray'
                                  ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {m.headline}
                            </span>
                          </div>

                          {/* 2-Player Side by Side */}
                          <div className="grid grid-cols-5 items-center gap-2">
                            {/* Player 1 */}
                            <div className="col-span-2 space-y-1">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xl">{m.player1.avatar}</span>
                                <span className="text-xs font-bold text-white truncate">
                                  {m.player1.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    m.player1.decision === 'cooperate'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                      : m.player1.decision === 'betray'
                                      ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {m.player1.decision}
                                </span>
                                <span className="font-mono text-xs font-black text-amber-400">
                                  +{m.player1.points}
                                </span>
                              </div>
                            </div>

                            {/* Center VS */}
                            <div className="col-span-1 text-center font-bold text-[10px] text-slate-400 uppercase">
                              vs
                            </div>

                            {/* Player 2 */}
                            <div className="col-span-2 space-y-1 text-right">
                              <div className="flex items-center justify-end gap-1.5 truncate">
                                <span className="text-xs font-bold text-white truncate">
                                  {m.player2.name}
                                </span>
                                <span className="text-xl">{m.player2.avatar}</span>
                              </div>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono text-xs font-black text-amber-400">
                                  +{m.player2.points}
                                </span>
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    m.player2.decision === 'cooperate'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                      : m.player2.decision === 'betray'
                                      ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {m.player2.decision}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: PAIR SYNERGY & TRUST DYNAMICS */}
      {activeHostTab === 'dynamics' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 animate-fade-in">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Handshake className="w-5 h-5 text-indigo-400" /> Head-to-Head Pair Synergy Analysis
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Analysis of repeated pairings, mutual trust index, and conflict points across all tournament rounds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupAnalysis.pairSummaries.map((ps) => (
              <div
                key={ps.pairKey}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{ps.player1.avatar || '🛡️'}</span>
                    <span className="text-xs font-bold text-white">{ps.player1.player_name}</span>
                    <span className="text-[10px] text-slate-400 font-bold">&</span>
                    <span className="text-xl">{ps.player2.avatar || '⚡'}</span>
                    <span className="text-xs font-bold text-white">{ps.player2.player_name}</span>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                    {ps.synergyType}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-900">
                  <div className="p-2 rounded-xl bg-slate-900/60">
                    <div className="text-[10px] text-slate-400">Matchups</div>
                    <div className="font-mono font-bold text-white">{ps.matchesPlayed}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-400">Mutual Trust</div>
                    <div className="font-mono font-bold text-emerald-300">{ps.mutualCooperations}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/20">
                    <div className="text-[10px] text-amber-400">Combined Pts</div>
                    <div className="font-mono font-bold text-amber-300">{ps.combinedPoints}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FACILITATOR DEBRIEF GUIDE */}
      {activeHostTab === 'debrief' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 animate-fade-in">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Facilitator Debrief Guide</h3>
              <p className="text-xs text-slate-400">Key reflection prompts for corporate workshop discussions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed text-slate-300">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-amber-300 text-sm block">1. The First Betrayal Catalyst:</span>
              <p>
                What happened to team cooperation after the first betrayal occurred? Did it trigger retaliatory defections in subsequent rounds?
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-indigo-300 text-sm block">2. Short-Term Win vs Long-Term Harmony:</span>
              <p>
                Did the highest scorer win through relentless cooperation or calculated timing? How does this map to cross-department project deadlines?
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-emerald-300 text-sm block">3. Psychological Safety & Trust:</span>
              <p>
                If players could have negotiated between rounds, would cooperation have stayed higher? How can our team build explicit psychological safety?
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
