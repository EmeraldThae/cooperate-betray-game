import React, { useState } from 'react';
import { Game, Player, Round, Decision } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { PlayerList } from '../components/PlayerList';
import { Leaderboard } from '../components/Leaderboard';
import { Shield, Zap, Eye, ArrowRight, Trophy, Users, RefreshCw, Sparkles, CheckCircle2, Tv } from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { playSound } from '../utils/audio';

interface HostDashboardProps {
  game: Game;
  players: Player[];
  currentRound: Round | null;
  decisions: Decision[];
  onRefresh?: () => void;
  onGameCompleted: () => void;
  onTogglePresenter?: () => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  game,
  players,
  currentRound,
  decisions,
  onRefresh,
  onGameCompleted,
  onTogglePresenter,
}) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const isRevealed = currentRound?.status === 'revealed' || game.status === 'results';
  const submittedPlayers = players.filter((p) => p.status === 'submitted' || decisions.some((d) => d.player_id === p.id));
  const submittedCount = submittedPlayers.length;
  const totalCount = players.length;
  const isAllSubmitted = totalCount > 0 && submittedCount >= totalCount;

  const validDecs = decisions.filter((d) => d.decision !== 'no_decision');
  const coopCount = validDecs.filter((d) => d.decision === 'cooperate').length;
  const betrayCount = validDecs.filter((d) => d.decision === 'betray').length;

  const handleReveal = async () => {
    if (!currentRound) return;
    setIsRevealing(true);
    playSound('reveal');
    try {
      await GameService.revealResults(currentRound.id, game.id);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Failed to reveal results:', e);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleNextRound = async () => {
    if (game.current_round >= game.total_rounds) {
      // Game is finished
      setIsAdvancing(true);
      playSound('victory');
      try {
        await GameService.completeGame(game.id);
        onGameCompleted();
      } catch (e) {
        console.error('Failed to complete game:', e);
      } finally {
        setIsAdvancing(false);
      }
      return;
    }

    setIsAdvancing(true);
    playSound('submit');
    try {
      await GameService.startRound(game.id, game.current_round + 1);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Failed to start next round:', e);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Status Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                HOST CONTROL PANEL
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                ROOM: <span className="text-amber-400">{game.game_code}</span>
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-2">
              Round {game.current_round} of {game.total_rounds}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {currentRound && !isRevealed && (
              <CountdownTimer
                startedAt={currentRound.started_at}
                durationSeconds={game.decision_time_seconds}
                onTimeout={() => {
                  // Timer expired - host can reveal immediately
                }}
              />
            )}

            {onTogglePresenter && (
              <button
                onClick={onTogglePresenter}
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
                id="btn-host-presenter"
              >
                <Tv className="w-4 h-4 text-indigo-400" /> Presenter View
              </button>
            )}
          </div>
        </div>

        {/* Dynamic State Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Submission Monitor */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Submissions</div>
              <div className="text-xl font-mono font-black text-white mt-0.5">
                {submittedCount} / {totalCount} Players
              </div>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              isAllSubmitted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Current Stage */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Round Stage</div>
              <div className="text-base font-bold text-indigo-300 mt-0.5">
                {isRevealed ? 'Results Revealed & Scored' : isAllSubmitted ? 'All Submitted - Ready to Reveal' : 'Waiting for Decisions'}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          {/* Host Primary Action Button */}
          <div className="flex items-center">
            {!isRevealed ? (
              <button
                onClick={handleReveal}
                disabled={isRevealing || totalCount === 0}
                className="w-full h-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-95"
                id="btn-host-reveal-results"
              >
                {isRevealing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span>REVEAL ROUND {game.current_round} RESULTS</span>
              </button>
            ) : (
              <button
                onClick={handleNextRound}
                disabled={isAdvancing}
                className="w-full h-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-95"
                id="btn-host-next-round"
              >
                {isAdvancing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>
                  {game.current_round >= game.total_rounds
                    ? 'VIEW FINAL TOURNAMENT RESULTS 🏆'
                    : `PROCEED TO ROUND ${game.current_round + 1} ➔`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Revealed Breakdown Banner if revealed */}
      {isRevealed && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Round {game.current_round} Decision Breakdown
            </h3>
            <span className="text-xs font-mono font-semibold text-slate-400">
              {coopCount} Cooperated • {betrayCount} Betrayed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Cooperate Choices</div>
                  <div className="text-xs text-slate-400">Worked towards collective cooperation</div>
                </div>
              </div>
              <div className="font-mono text-2xl font-black text-emerald-400">{coopCount}</div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Betray Choices</div>
                  <div className="text-xs text-slate-400">Pursued individual advantage</div>
                </div>
              </div>
              <div className="font-mono text-2xl font-black text-rose-400">{betrayCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Player Submissions & Live Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Player Submissions Matrix */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Participant Status
            </h3>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          <PlayerList
            players={players}
            decisions={decisions}
            showDecisions={isRevealed}
          />
        </div>

        {/* Right: Real-time Leaderboard */}
        <div className="md:col-span-5">
          <Leaderboard
            players={players}
            decisions={isRevealed ? decisions : []}
          />
        </div>
      </div>
    </div>
  );
};
