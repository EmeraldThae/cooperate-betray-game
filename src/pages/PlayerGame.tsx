import React, { useState, useEffect } from 'react';
import { Game, Player, Round, Decision, DecisionType } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { DecisionButtons } from '../components/DecisionButtons';
import { Leaderboard } from '../components/Leaderboard';
import { Shield, Zap, Award, CheckCircle2, Clock, Trophy, Sparkles, TrendingUp } from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { playSound } from '../utils/audio';

interface PlayerGameProps {
  game: Game;
  player: Player;
  players: Player[];
  currentRound: Round | null;
  decisions: Decision[];
  onRefresh?: () => void;
}

export const PlayerGame: React.FC<PlayerGameProps> = ({
  game,
  player,
  players,
  currentRound,
  decisions,
  onRefresh,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localDecision, setLocalDecision] = useState<DecisionType | null>(null);

  // Check if player has already submitted for this round
  const myDecisionRecord = decisions.find((d) => d.player_id === player.id);
  const isLocked = Boolean(myDecisionRecord) || player.status === 'submitted';
  const effectiveDecision = myDecisionRecord?.decision || localDecision;

  const isRevealed = currentRound?.status === 'revealed' || game.status === 'results';

  // Keyboard shortcut listener for fast corporate training participation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked || isRevealed || isSubmitting) return;
      if (e.key === 'c' || e.key === 'C') {
        handleSubmitDecision('cooperate');
      } else if (e.key === 'b' || e.key === 'B') {
        handleSubmitDecision('betray');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isRevealed, isSubmitting, currentRound]);

  const handleSubmitDecision = async (choice: DecisionType) => {
    if (!currentRound || isLocked || isSubmitting) return;
    setIsSubmitting(true);
    setLocalDecision(choice);
    playSound('submit');

    try {
      await GameService.submitDecision(currentRound.id, player.id, choice, game.id);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Failed to submit decision:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeout = () => {
    // When timer expires, if not submitted, submit no_decision automatically
    if (!isLocked && currentRound) {
      handleSubmitDecision('no_decision');
    }
  };

  // Calculate my round outcome points
  const pointsAwarded = myDecisionRecord?.points ?? 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6">
      {/* Player Header Banner */}
      <div className="p-5 md:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-2xl shadow-inner">
            {player.avatar || '🛡️'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-xl text-white">{player.player_name}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                ACTIVE
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Round <span className="text-white font-bold">{game.current_round}</span> of {game.total_rounds}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          {/* Synchronized Timer */}
          {currentRound && !isRevealed && (
            <CountdownTimer
              startedAt={currentRound.started_at}
              durationSeconds={game.decision_time_seconds}
              onTimeout={handleTimeout}
              size="md"
            />
          )}

          {/* Current Player Total Score */}
          <div className="text-right px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Score</div>
            <div className="font-mono text-xl font-black text-amber-400 leading-none mt-0.5">
              {player.score} <span className="text-xs text-slate-400 font-normal">pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      {!isRevealed ? (
        <div className="space-y-6">
          <div className="text-center space-y-2 max-w-md mx-auto">
            <h3 className="text-xl md:text-2xl font-black text-white">
              {isLocked ? 'Secret Choice Confirmed' : 'Make Your Secret Choice'}
            </h3>
            <p className="text-xs md:text-sm text-slate-400">
              {isLocked
                ? 'Your choice is safely encrypted in Supabase. Waiting for Host to reveal.'
                : 'Will you support the group or seek individual advantage?'}
            </p>
          </div>

          {/* Decision Cards */}
          <DecisionButtons
            onSelect={handleSubmitDecision}
            selectedDecision={effectiveDecision}
            isLocked={isLocked}
            disabled={isSubmitting}
          />
        </div>
      ) : (
        /* Revealed Round Results Banner */
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-xs font-bold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>ROUND {game.current_round} RESULTS REVEALED</span>
          </div>

          <div className="max-w-md mx-auto space-y-3">
            <div className="text-sm text-slate-400">You chose:</div>
            <div className="text-3xl font-black uppercase tracking-wider">
              {effectiveDecision === 'cooperate' ? (
                <span className="text-emerald-400 flex items-center justify-center gap-2">
                  <Shield className="w-7 h-7" /> COOPERATE
                </span>
              ) : effectiveDecision === 'betray' ? (
                <span className="text-rose-400 flex items-center justify-center gap-2">
                  <Zap className="w-7 h-7" /> BETRAY
                </span>
              ) : (
                <span className="text-slate-400">NO DECISION</span>
              )}
            </div>

            {/* Score change badge */}
            <div className="inline-block p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner mt-2">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Points Earned This Round</div>
              <div className="font-mono text-4xl font-black text-emerald-400 mt-1">
                +{pointsAwarded} <span className="text-lg text-slate-400">pts</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 pt-2">
            Waiting for Host to advance to the next round...
          </div>
        </div>
      )}

      {/* Live Standings Table */}
      <div className="pt-2">
        <Leaderboard
          players={players}
          decisions={isRevealed ? decisions : []}
          highlightPlayerId={player.id}
        />
      </div>
    </div>
  );
};
