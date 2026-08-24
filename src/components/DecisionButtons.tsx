import React from 'react';
import { ShieldCheck, Zap, Lock, CheckCircle2 } from 'lucide-react';
import { DecisionType } from '../types';
import { playSound } from '../utils/audio';

interface DecisionButtonsProps {
  onSelect: (decision: DecisionType) => void;
  selectedDecision: DecisionType | null;
  isLocked: boolean;
  disabled?: boolean;
}

export const DecisionButtons: React.FC<DecisionButtonsProps> = ({
  onSelect,
  selectedDecision,
  isLocked,
  disabled = false,
}) => {
  const handleChoice = (choice: 'cooperate' | 'betray') => {
    if (isLocked || disabled) return;
    playSound('click');
    onSelect(choice);
  };

  if (isLocked && selectedDecision) {
    const isCooperate = selectedDecision === 'cooperate';
    return (
      <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-center animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 mb-3">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>DECISION SUBMITTED & ENCRYPTED</span>
        </div>

        <h3 className="text-xl font-black text-white mb-1">
          You chose: <span className={isCooperate ? 'text-emerald-400 uppercase' : 'text-rose-400 uppercase'}>{selectedDecision}</span>
        </h3>
        
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mt-2">
          Your secret choice has been submitted. Row Level Security ensures no other player or host can see your decision until the reveal phase.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-indigo-300 bg-indigo-950/40 py-2.5 px-4 rounded-xl border border-indigo-500/30">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          Waiting for remaining players & Host reveal...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Cooperate Button */}
      <button
        onClick={() => handleChoice('cooperate')}
        disabled={disabled || isLocked}
        className={`w-full group relative overflow-hidden p-6 md:p-8 rounded-2xl border-2 text-left transition-all duration-200 shadow-xl ${
          selectedDecision === 'cooperate'
            ? 'bg-emerald-950 border-emerald-400 ring-4 ring-emerald-500/30 scale-[1.02]'
            : 'bg-slate-900/90 border-emerald-900/60 hover:border-emerald-500/80 hover:bg-emerald-950/30 hover:scale-[1.01]'
        } ${disabled || isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        id="btn-choice-cooperate"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/30 transition shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-black tracking-wider text-emerald-400 uppercase">
                COOPERATE
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300">
                Key: C
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
              Work together and build mutual trust.
            </p>
          </div>
        </div>
      </button>

      {/* Betray Button */}
      <button
        onClick={() => handleChoice('betray')}
        disabled={disabled || isLocked}
        className={`w-full group relative overflow-hidden p-5 md:p-7 rounded-2xl border-2 text-left transition-all duration-200 shadow-xl ${
          selectedDecision === 'betray'
            ? 'bg-rose-950 border-rose-400 ring-4 ring-rose-500/30 scale-[1.02]'
            : 'bg-slate-900/90 border-rose-900/60 hover:border-rose-500/80 hover:bg-rose-950/30 hover:scale-[1.01]'
        } ${disabled || isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        id="btn-choice-betray"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 group-hover:scale-110 group-hover:bg-rose-500/30 transition shrink-0">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-black tracking-wider text-rose-400 uppercase">
                BETRAY
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950 border border-rose-600 text-rose-300">
                Key: B
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
              Choose yourself and pursue individual gain.
            </p>
          </div>
        </div>
      </button>
    </div>
  );
};
