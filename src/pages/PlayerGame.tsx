import React, { useState, useEffect } from 'react';
import { Game, Player, Round, Decision, DecisionType } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { DecisionButtons } from '../components/DecisionButtons';
import {
  Shield,
  Zap,
  CheckCircle2,
  Clock,
  Trophy,
  Sparkles,
  Swords,
  Award,
  Crown,
  Handshake,
  AlertCircle,
} from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { playSound } from '../utils/audio';
import { calculatePairMatchOutcome, findPlayerOpponent } from '../utils/gameLogic';

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

  // Pairings for this round
  const activePairings = currentRound?.pairings || game.current_pairings || [];
  const { opponent, isPlayer1 } = findPlayerOpponent(player.id, activePairings, players);

  // Check if player and opponent have submitted for this round
  const myDecisionRecord = decisions.find((d) => d.player_id === player.id);
  const opponentDecisionRecord = opponent ? decisions.find((d) => d.player_id === opponent.id) : null;

  const isLocked = Boolean(myDecisionRecord) || player.status === 'submitted';
  const effectiveDecision = myDecisionRecord?.decision || localDecision;
  const isOpponentLocked = Boolean(opponentDecisionRecord) || opponent?.status === 'submitted';

  const isRevealed = currentRound?.status === 'revealed' || game.status === 'results';

  // Keyboard shortcuts (C for Cooperate, B for Betray)
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
    if (!isLocked && currentRound) {
      handleSubmitDecision('no_decision');
    }
  };

  // Calculate pairwise duel result when revealed
  const myDec = effectiveDecision || 'no_decision';
  const oppDec = opponentDecisionRecord?.decision || 'no_decision';
  const duelCalc = calculatePairMatchOutcome(
    isPlayer1 ? myDec : oppDec,
    isPlayer1 ? oppDec : myDec
  );
  const myDuelPoints = isPlayer1 ? duelCalc.p1Points : duelCalc.p2Points;
  const oppDuelPoints = isPlayer1 ? duelCalc.p2Points : duelCalc.p1Points;

  // Determine round winner between the two players
  let roundDuelWinner: 'you' | 'opponent' | 'tie' = 'tie';
  if (myDuelPoints > oppDuelPoints) {
    roundDuelWinner = 'you';
  } else if (oppDuelPoints > myDuelPoints) {
    roundDuelWinner = 'opponent';
  } else {
    roundDuelWinner = 'tie';
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-4 py-4 md:py-7 space-y-5">
      {/* 1. Player Header Banner with Countdown Timer & Score */}
      <div className="p-4 md:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        <div className="flex items-center gap-3.5 self-end sm:self-auto">
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
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Your Total Score</div>
            <div className="font-mono text-xl font-black text-amber-400 leading-none mt-0.5">
              {player.score} <span className="text-xs text-slate-400 font-normal">pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP SECTION: COOPERATE & BETRAY ACTION BUTTONS */}
      {!isRevealed ? (
        <div className="space-y-4 pt-1">
          <div className="text-center space-y-1 max-w-md mx-auto px-2">
            <h3 className="text-lg md:text-2xl font-black text-white">
              {isLocked ? 'Secret Choice Confirmed 🔒' : `Choose Your Action vs ${opponent?.player_name || 'Opponent'}`}
            </h3>
            <p className="text-xs md:text-sm text-slate-400">
              {isLocked
                ? 'Your choice is securely locked. Waiting for Host to reveal round results.'
                : 'Tap Cooperate or Betray below to submit your move for this round:'}
            </p>
          </div>

          {/* Primary Action Buttons */}
          <DecisionButtons
            onSelect={handleSubmitDecision}
            selectedDecision={effectiveDecision}
            isLocked={isLocked}
            disabled={isSubmitting}
          />
        </div>
      ) : (
        /* Top Banner when Results are Revealed - 1v1 Winner Focus */
        <div
          className={`p-4 md:p-6 rounded-3xl border text-center space-y-2 animate-fade-in shadow-xl ${
            roundDuelWinner === 'you'
              ? 'bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/50'
              : roundDuelWinner === 'opponent'
              ? 'bg-gradient-to-b from-rose-950/80 via-slate-900 to-slate-950 border-rose-500/50'
              : 'bg-gradient-to-b from-indigo-950/80 via-slate-900 to-slate-950 border-indigo-500/50'
          }`}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-950/80 border border-slate-800">
            {roundDuelWinner === 'you' ? (
              <>
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-emerald-400">ROUND {game.current_round} DUEL WINNER: YOU</span>
              </>
            ) : roundDuelWinner === 'opponent' ? (
              <>
                <Zap className="w-4 h-4 text-rose-400" />
                <span className="text-rose-400">ROUND {game.current_round} DUEL WINNER: {opponent?.player_name || 'OPPONENT'}</span>
              </>
            ) : (
              <>
                <Handshake className="w-4 h-4 text-indigo-400" />
                <span className="text-indigo-300">ROUND {game.current_round} DUEL: TIED MATCHUP</span>
              </>
            )}
          </div>

          <h3 className="text-xl md:text-2xl font-black text-white">
            {roundDuelWinner === 'you'
              ? `You Won (+${myDuelPoints} pts vs +${oppDuelPoints} pts)`
              : roundDuelWinner === 'opponent'
              ? `${opponent?.player_name || 'Opponent'} Won (+${oppDuelPoints} pts vs +${myDuelPoints} pts)`
              : `Both Scored (+${myDuelPoints} pts each)`}
          </h3>

          <p className="text-xs md:text-sm text-slate-300 max-w-md mx-auto">
            {duelCalc.description}
          </p>
        </div>
      )}

      {/* 3. 1-ON-1 MATCH PAIR SECTION (Strictly between You & Your Opponent) */}
      <div className="p-4 md:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-400">
            <Swords className="w-4 h-4 text-rose-400" />
            <span>1-on-1 Head-to-Head (Round {game.current_round})</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
            {isRevealed ? 'Results Revealed' : isLocked ? 'Locked' : 'Deciding'}
          </span>
        </div>

        {/* 2-Player Side by Side */}
        <div className="grid grid-cols-5 items-center gap-2 md:gap-4 py-1">
          {/* You (Player 1) */}
          <div
            className={`col-span-2 p-3.5 md:p-4 rounded-2xl border space-y-2 ${
              isRevealed && roundDuelWinner === 'you'
                ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/30'
                : 'bg-indigo-950/40 border-indigo-500/30'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-2xl md:text-3xl">{player.avatar || '🛡️'}</span>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-indigo-300 font-black uppercase tracking-wider">YOU</span>
                  {isRevealed && roundDuelWinner === 'you' && (
                    <span className="text-[9px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-mono">
                      WINNER
                    </span>
                  )}
                </div>
                <div className="text-xs md:text-sm font-bold text-white truncate">{player.player_name}</div>
              </div>
            </div>

            <div className="pt-0.5 text-xs">
              {isRevealed ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {effectiveDecision === 'cooperate' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                        <Shield className="w-3 h-3" /> COOPERATED
                      </span>
                    ) : effectiveDecision === 'betray' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-400 bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-500/40">
                        <Zap className="w-3 h-3" /> BETRAYED
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-800 px-2 py-0.5 rounded-lg">
                        TIMED OUT
                      </span>
                    )}
                    <span className="font-mono text-xs font-black text-emerald-400 ml-auto">
                      +{myDuelPoints} pts
                    </span>
                  </div>
                </div>
              ) : isLocked ? (
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Locked In</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  <Clock className="w-3 h-3 animate-pulse" />
                  <span>Deciding...</span>
                </div>
              )}
            </div>
          </div>

          {/* Center Clash VS */}
          <div className="col-span-1 flex flex-col items-center justify-center text-center">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-rose-400 shadow-md">
              VS
            </div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1 hidden sm:block">
              1v1
            </div>
          </div>

          {/* Opponent (Player 2) */}
          <div
            className={`col-span-2 p-3.5 md:p-4 rounded-2xl border space-y-2 text-right ${
              isRevealed && roundDuelWinner === 'opponent'
                ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/30'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-end gap-2 truncate">
              <div className="truncate">
                <div className="flex items-center justify-end gap-1.5">
                  {isRevealed && roundDuelWinner === 'opponent' && (
                    <span className="text-[9px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-mono">
                      WINNER
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">OPPONENT</span>
                </div>
                <div className="text-xs md:text-sm font-bold text-white truncate">
                  {opponent ? opponent.player_name : 'Assigned Partner'}
                </div>
              </div>
              <span className="text-2xl md:text-3xl">{opponent?.avatar || '⚡'}</span>
            </div>

            <div className="pt-0.5 text-xs">
              {isRevealed ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-black text-emerald-400 mr-auto">
                      +{oppDuelPoints} pts
                    </span>
                    {oppDec === 'cooperate' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                        <Shield className="w-3 h-3" /> COOPERATED
                      </span>
                    ) : oppDec === 'betray' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-400 bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-500/40">
                        <Zap className="w-3 h-3" /> BETRAYED
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-800 px-2 py-0.5 rounded-lg">
                        TIMED OUT
                      </span>
                    )}
                  </div>
                </div>
              ) : isOpponentLocked ? (
                <div className="inline-flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Locked In</span>
                </div>
              ) : (
                <div className="inline-flex items-center justify-end gap-1 text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                  <Clock className="w-3 h-3 animate-pulse text-indigo-400" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. POST-REVEAL 1-ON-1 SCORE SUMMARY (Exclusively between these two players) */}
      {isRevealed && (
        <div className="p-5 md:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 animate-fade-in text-center">
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left">
              <div className="text-[10px] font-bold text-slate-400 uppercase">You Gained</div>
              <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">
                +{myDuelPoints} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total: {player.score} pts</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{opponent?.player_name || 'Opponent'} Gained</div>
              <div className="text-2xl font-mono font-black text-amber-400 mt-0.5">
                +{oppDuelPoints} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total: {opponent?.score || 0} pts</div>
            </div>
          </div>

          <div className="text-xs text-slate-400 pt-1">
            Waiting for Host to advance to the next round...
          </div>
        </div>
      )}
    </div>
  );
};

