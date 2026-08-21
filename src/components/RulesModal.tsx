import React from 'react';
import { X, ShieldCheck, Zap, Award, Users, Scale, Sparkles } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100"
        id="rules-modal-dialog"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          aria-label="Close rules"
          id="btn-close-rules"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">The Rules of Cooperate & Betray</h2>
            <p className="text-sm text-slate-400">A Strategic Multiplayer Dilemma for High-Performance Teams</p>
          </div>
        </div>

        {/* The Concept */}
        <div className="mb-6 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <p className="text-sm leading-relaxed text-slate-300">
            In each round, every player secretly chooses either <span className="font-semibold text-emerald-400">COOPERATE</span> or <span className="font-semibold text-rose-400">BETRAY</span>. No one sees your choice until the Host reveals the results. Your score depends directly on what everyone else chose.
          </p>
        </div>

        {/* Decision Matrix */}
        <h3 className="text-base font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-400" /> The Payoff Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {/* Scenario 1 */}
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1">
              <ShieldCheck className="w-4 h-4" /> 1. Collective Harmony
            </div>
            <p className="text-xs text-slate-300 mb-2">Everyone chooses COOPERATE.</p>
            <div className="inline-block px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold">
              +3 Points for Everyone
            </div>
          </div>

          {/* Scenario 2 */}
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-1">
              <Zap className="w-4 h-4" /> 2. Exploitative Betrayal
            </div>
            <p className="text-xs text-slate-300 mb-2">Some Cooperate, while some Betray.</p>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-xs font-bold">
                Betrayers: +5 pts
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-xs">
                Cooperators: +0 pts
              </span>
            </div>
          </div>

          {/* Scenario 3 */}
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-1">
              <Users className="w-4 h-4" /> 3. Mutual Destruction
            </div>
            <p className="text-xs text-slate-300 mb-2">Everyone chooses BETRAY.</p>
            <div className="inline-block px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
              +1 Point for Everyone
            </div>
          </div>

          {/* Scenario 4 */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 font-semibold text-sm mb-1">
              <Sparkles className="w-4 h-4" /> 4. Inaction / Timeout
            </div>
            <p className="text-xs text-slate-300 mb-2">Timer expires before submitting.</p>
            <div className="inline-block px-2.5 py-1 rounded bg-slate-700 text-slate-400 font-mono text-xs">
              0 Points (No Decision)
            </div>
          </div>
        </div>

        {/* Debrief Key Takeaway */}
        <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200">
          <span className="font-bold text-indigo-300">Corporate Training Insight:</span> Betraying yields a high immediate payoff (+5), but quickly breaks team cooperation for future rounds, forcing everyone into the low-yield +1 cycle. Can your team maintain mutual cooperation across multiple rounds?
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/30"
            id="btn-understand-rules"
          >
            I Understand the Stakes
          </button>
        </div>
      </div>
    </div>
  );
};
