import React from 'react';
import { Shield, Zap, Users, Play, PlusCircle, LogIn, Scale, ArrowRight, Award, Sparkles } from 'lucide-react';

interface HomeProps {
  onCreateGame: () => void;
  onJoinGame: () => void;
  onOpenRules: () => void;
  onQuickDemo: () => void;
}

export const Home: React.FC<HomeProps> = ({
  onCreateGame,
  onJoinGame,
  onOpenRules,
  onQuickDemo,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-16 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 text-xs font-semibold text-indigo-300 shadow-lg shadow-indigo-950/50">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Professional Multiplayer Team Dilemma & Cooperation Lab</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-[64px] font-black tracking-tight text-white leading-none">
          COOPERATE <span className="text-rose-500">&</span> BETRAY
        </h1>

        <p className="text-xl sm:text-[22px] font-bold text-slate-200 tracking-tight">
          Can you cooperate with others when betrayal is an option?
        </p>

        <p className="text-sm sm:text-[15px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Make your decision. Build cooperation. Take the risk. An interactive real-time decision-making platform engineered for leadership workshops, team-building retreats, and communication exercises.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onCreateGame}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 transition transform hover:scale-105 active:scale-95"
            id="btn-home-create-game"
          >
            <PlusCircle className="w-5 h-5" />
            <span>CREATE GAME</span>
          </button>

          <button
            onClick={onJoinGame}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg border border-slate-700 shadow-xl flex items-center justify-center gap-3 transition transform hover:scale-105 active:scale-95"
            id="btn-home-join-game"
          >
            <LogIn className="w-5 h-5 text-emerald-400" />
            <span>JOIN GAME</span>
          </button>
        </div>

        {/* Quick sandbox demo runner */}
        <div className="pt-2">
          <button
            onClick={onQuickDemo}
            className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40 transition"
            id="btn-home-instant-demo"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Instant 4-Player Simulation (No Setup Required)</span>
          </button>
        </div>
      </div>

      {/* Decision Matrix Teaser Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        {/* Cooperate Card */}
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-emerald-900/50 shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition" />
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">COOPERATE</h3>
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            Align with the collective team to generate consistent, mutual value. When everyone collaborates, all participants thrive.
          </p>
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/30">
            Collective Harmony: +3 pts each
          </div>
        </div>

        {/* Betray Card */}
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-rose-900/50 shadow-2xl relative overflow-hidden group hover:border-rose-500/50 transition">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition" />
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">BETRAY</h3>
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            Prioritize immediate individual advantage. If you defect while teammates cooperate, you harvest the maximum payoff.
          </p>
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-rose-400 bg-rose-950/60 px-3 py-1.5 rounded-lg border border-rose-500/30">
            Exploitation Payoff: +5 pts (0 for cooperators)
          </div>
        </div>
      </div>

      {/* Target Audiences */}
      <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Ideal for Facilitated Corporate Workshops</h3>
            <p className="text-xs text-slate-400">Structured decision dynamics for modern cross-functional teams</p>
          </div>
          <button
            onClick={onOpenRules}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View Full Payoff Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <Users className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-slate-200">Leadership Labs</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Strategy & Ethics</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <Scale className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-slate-200">Team Collaboration</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Cross-Functional Synergy</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <Award className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-slate-200">Executive Offsites</div>
            <div className="text-[11px] text-slate-400 mt-0.5">High-Stakes Cooperation</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <Sparkles className="w-5 h-5 text-purple-400 mx-auto mb-2" />
            <div className="font-bold text-sm text-slate-200">Communication</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Behavioral Analysis</div>
          </div>
        </div>
      </div>
    </div>
  );
};
