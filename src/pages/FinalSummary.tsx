import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Game, Player, Decision, Round } from '../types';
import { calculateGameStatistics, calculateGroupTournamentAnalysis } from '../utils/gameLogic';
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
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Handshake,
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
  const [activeTab, setActiveTab] = useState<'individual' | 'group' | 'dynamics' | 'debrief'>('individual');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number | 'all'>('all');

  const stats = calculateGameStatistics(game, players, allDecisions);
  const groupAnalysis = calculateGroupTournamentAnalysis(game, players, allRounds, allDecisions);

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
    
    // 1. Individual Standings Section
    let csv = '=== INDIVIDUAL PLAYER STANDINGS ===\n';
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
    link.download = `Cooperate_Betray_${game.game_code}_Full_Tournament_Report.csv`;
    link.click();
  };

  // Filtered round numbers for group view
  const roundNumbers = Object.keys(groupAnalysis.roundMatches)
    .map(Number)
    .sort((a, b) => a - b);

  const displayedRounds = selectedRoundFilter === 'all'
    ? roundNumbers
    : roundNumbers.filter((r) => r === selectedRoundFilter);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* 1. Winner Spotlight Header */}
      <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl text-center space-y-4 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs font-black text-amber-300">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>TOURNAMENT CONCLUDED</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          CHAMPION OF STRATEGY
        </h1>

        <div className="py-2">
          <span className="text-3xl md:text-5xl font-black text-amber-400 font-mono">
            {stats.winner_names.join(' & ')}
          </span>
          <div className="text-sm font-semibold text-slate-400 mt-1">
            Winning Score: <span className="text-white font-bold">{stats.highest_score} Points</span>
          </div>
        </div>

        <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Completed {game.total_rounds} strategic rounds with {players.length} players and {groupAnalysis.totalGroupMatches} 1v1 pair duels.
        </p>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-2 transition"
            id="btn-export-csv"
          >
            <Download className="w-4 h-4 text-indigo-400" /> Export Full Tournament CSV
          </button>

          {role === 'host' && (
            <button
              onClick={onResetGame}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
              id="btn-host-reset-game"
            >
              <RotateCcw className="w-4 h-4" /> Start New Session
            </button>
          )}

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

      {/* 3. Navigation Tabs */}
      <div className="flex items-center justify-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'individual'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-individual"
        >
          <Trophy className="w-4 h-4" />
          <span>Individual Standings</span>
        </button>

        <button
          onClick={() => setActiveTab('group')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'group'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-group"
        >
          <Layers className="w-4 h-4" />
          <span>Group Results ({groupAnalysis.totalGroupMatches} Pair Duels)</span>
        </button>

        <button
          onClick={() => setActiveTab('dynamics')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'dynamics'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-dynamics"
        >
          <Handshake className="w-4 h-4" />
          <span>Pair Synergy & Trust</span>
        </button>

        <button
          onClick={() => setActiveTab('debrief')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'debrief'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
          id="tab-final-debrief"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Workshop Debrief Guide</span>
        </button>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: INDIVIDUAL STANDINGS */}
      {activeTab === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          <div className="lg:col-span-8">
            <Leaderboard
              players={players}
              isFinal={true}
              highlightPlayerId={currentPlayerId}
            />
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Strategic Highlights
              </h3>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Cooperation Anchor
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
                  <Zap className="w-3.5 h-3.5" /> Risk Defector
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

      {/* TAB 2: GROUP RESULTS (Round-by-round pair matchups) */}
      {activeTab === 'group' && (
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
                      const isHighlighted =
                        currentPlayerId &&
                        (m.player1.id === currentPlayerId || m.player2.id === currentPlayerId);

                      return (
                        <div
                          key={m.pairId}
                          className={`p-4 rounded-2xl border transition-all ${
                            isHighlighted
                              ? 'bg-indigo-950/40 border-indigo-500/60 ring-2 ring-indigo-500/20'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
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
                            {isHighlighted && (
                              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded">
                                Your Match
                              </span>
                            )}
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
      {activeTab === 'dynamics' && (
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
      {activeTab === 'debrief' && (
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
