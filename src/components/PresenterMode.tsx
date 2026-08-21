import React from 'react';
import { Game, Player, Round, Decision } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { ShieldCheck, Zap, Trophy, Users, Tv } from 'lucide-react';

interface PresenterModeProps {
  game: Game;
  players: Player[];
  currentRound: Round | null;
  decisions: Decision[];
  onExitPresenter: () => void;
  onReveal?: () => void;
  onNextRound?: () => void;
}

export const PresenterMode: React.FC<PresenterModeProps> = ({
  game,
  players,
  currentRound,
  decisions,
  onExitPresenter,
  onReveal,
  onNextRound,
}) => {
  const isRevealed = currentRound?.status === 'revealed' || game.status === 'results';
  const submittedCount = players.filter((p) => p.status === 'submitted' || decisions.some((d) => d.player_id === p.id)).length;
  const totalCount = players.length;

  const validDecs = decisions.filter((d) => d.decision !== 'no_decision');
  const coopCount = validDecs.filter((d) => d.decision === 'cooperate').length;
  const betrayCount = validDecs.filter((d) => d.decision === 'betray').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-6 md:p-12 overflow-y-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl font-black tracking-wider text-white">
              COOPERATE <span className="text-rose-500">&</span> BETRAY
            </span>
            <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold uppercase tracking-widest">
              Workshop Projector Mode
            </span>
          </div>
          <div className="text-slate-400 text-sm mt-1">
            Room Code: <span className="font-mono text-amber-400 font-bold tracking-widest text-lg">{game.game_code}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentRound && game.status === 'round_active' && (
            <CountdownTimer
              startedAt={currentRound.started_at}
              durationSeconds={game.decision_time_seconds}
              size="md"
            />
          )}

          <button
            onClick={onExitPresenter}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 flex items-center gap-2"
          >
            <Tv className="w-4 h-4" /> Exit Presenter
          </button>
        </div>
      </div>

      {/* Main Big Stage */}
      <div className="flex-1 my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Round Status / Decision Matrix */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-4">
            <div className="text-xs uppercase font-bold tracking-widest text-indigo-400">
              Round {game.current_round} of {game.total_rounds}
            </div>

            {game.status === 'lobby' ? (
              <div className="py-12 space-y-4">
                <h2 className="text-4xl md:text-5xl font-black text-white">Waiting for Players to Join</h2>
                <p className="text-slate-400 text-lg">
                  Join at <span className="text-indigo-400 font-bold underline">this screen</span> using Room Code: <span className="font-mono text-amber-400 font-black text-2xl">{game.game_code}</span>
                </p>
              </div>
            ) : game.status === 'round_active' ? (
              <div className="py-8 space-y-6">
                <h2 className="text-4xl md:text-5xl font-black text-white">
                  Decisions are Being Submitted
                </h2>
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 font-mono text-2xl font-bold">
                  <span>{submittedCount} / {totalCount} Players Submitted</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Decisions remain encrypted and secret until the reveal stage.
                </p>
              </div>
            ) : isRevealed ? (
              <div className="py-6 space-y-6">
                <h2 className="text-3xl md:text-4xl font-black text-white">Round {game.current_round} Results Revealed!</h2>
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center">
                    <div className="text-3xl font-black text-emerald-400 font-mono">{coopCount}</div>
                    <div className="text-xs uppercase font-bold text-emerald-300 mt-1">Cooperated</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-center">
                    <div className="text-3xl font-black text-rose-400 font-mono">{betrayCount}</div>
                    <div className="text-xs uppercase font-bold text-rose-300 mt-1">Betrayed</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-4">
                <h2 className="text-3xl md:text-4xl font-black text-white">Tournament Completed!</h2>
              </div>
            )}

            {/* Facilitator Action */}
            <div className="pt-4 flex justify-center gap-4">
              {game.status === 'round_active' && onReveal && (
                <button
                  onClick={onReveal}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-lg shadow-xl shadow-indigo-600/30 transition transform hover:scale-105"
                >
                  REVEAL RESULTS 🔓
                </button>
              )}
              {isRevealed && onNextRound && game.current_round < game.total_rounds && (
                <button
                  onClick={onNextRound}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-lg shadow-xl shadow-emerald-600/30 transition transform hover:scale-105"
                >
                  START ROUND {game.current_round + 1} ➔
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Big Leaderboard */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-lg border-b border-slate-800 pb-3">
            <Trophy className="w-6 h-6" /> Live Leaderboard
          </div>

          <div className="space-y-2">
            {[...players].sort((a, b) => b.score - a.score).map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border ${
                  idx === 0 ? 'bg-amber-950/30 border-amber-500/50' : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-400 w-5">#{idx + 1}</span>
                  <span className="text-xl">{p.avatar || '🛡️'}</span>
                  <span className="font-bold text-base text-white">{p.player_name}</span>
                </div>
                <div className="font-mono text-xl font-black text-white">
                  {p.score} <span className="text-xs font-normal text-slate-400">pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
