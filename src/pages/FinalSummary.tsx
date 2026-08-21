import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Game, Player, Decision } from '../types';
import { calculateGameStatistics } from '../utils/gameLogic';
import { Trophy, Award, Shield, Zap, RotateCcw, Download, Share2, HelpCircle, Users, BarChart3, Sparkles } from 'lucide-react';
import { Leaderboard } from '../components/Leaderboard';
import { playSound } from '../utils/audio';

interface FinalSummaryProps {
  game: Game;
  players: Player[];
  allDecisions?: Decision[];
  role: 'host' | 'player';
  currentPlayerId?: string;
  onResetGame: () => void;
  onHome: () => void;
}

export const FinalSummary: React.FC<FinalSummaryProps> = ({
  game,
  players,
  allDecisions = [],
  role,
  currentPlayerId,
  onResetGame,
  onHome,
}) => {
  const stats = calculateGameStatistics(game, players, allDecisions);

  useEffect(() => {
    playSound('victory');
    // Launch celebratory confetti
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
    let csv = 'Rank,Player Name,Total Score,Status\n';
    sorted.forEach((p, idx) => {
      csv += `${idx + 1},"${p.player_name}",${p.score},${p.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cooperate_Betray_${game.game_code}_Summary.csv`;
    link.click();
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-14 space-y-10">
      {/* Winner Spotlight Header */}
      <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl text-center space-y-4 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs font-black text-amber-300">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>TOURNAMENT CONCLUDED</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
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

        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          Completed {game.total_rounds} intense strategic rounds across {players.length} participants.
        </p>

        {/* Export & Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-2 transition"
            id="btn-export-csv"
          >
            <Download className="w-4 h-4 text-indigo-400" /> Export CSV Report
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

      {/* Team Behavioral Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cooperation Index */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Team Cooperation Index
          </div>
          <div className="font-mono text-3xl font-black text-emerald-400">
            {stats.cooperation_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-400">Total Cooperate Decisions</div>
        </div>

        {/* Betrayal Temptation */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-rose-400" /> Defection Rate
          </div>
          <div className="font-mono text-3xl font-black text-rose-400">
            {stats.betrayal_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-400">Total Betray Decisions</div>
        </div>

        {/* Cooperation Anchor */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-indigo-400" /> Cooperation Anchor
          </div>
          <div className="font-bold text-lg text-white truncate">
            {stats.most_cooperative_player?.name || 'Everyone'}
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.most_cooperative_player ? `${stats.most_cooperative_player.rate}% Cooperation` : 'Balanced'}
          </div>
        </div>

        {/* Strategic Defector */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Risk Defector
          </div>
          <div className="font-bold text-lg text-white truncate">
            {stats.biggest_betrayer?.name || 'None'}
          </div>
          <div className="text-[11px] text-slate-400">
            {stats.biggest_betrayer ? `${stats.biggest_betrayer.rate}% Betrayal` : 'Pure Cooperation'}
          </div>
        </div>
      </div>

      {/* Main Grid: Final Leaderboard & Facilitator Debrief */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Final Standings */}
        <div className="lg:col-span-6">
          <Leaderboard
            players={players}
            isFinal={true}
            highlightPlayerId={currentPlayerId}
          />
        </div>

        {/* Corporate Facilitator Debrief Guide */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Facilitator Debrief Guide</h3>
              <p className="text-xs text-slate-400">Key reflection prompts for corporate workshop discussions</p>
            </div>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-slate-300">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-bold text-amber-300 block mb-1">1. The First Betrayal Catalyst:</span>
              What happened to team cooperation after the first betrayal occurred? Did it trigger retaliatory defections in subsequent rounds?
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-bold text-indigo-300 block mb-1">2. Short-Term Win vs Long-Term Harmony:</span>
              Did the highest scorer win through relentless cooperation or calculated timing? How does this map to cross-department project deadlines?
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="font-bold text-emerald-300 block mb-1">3. Communication & Contractual Cooperation:</span>
              If players could have negotiated between rounds, would cooperation have stayed higher? How can our team build explicit psychological safety?
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
