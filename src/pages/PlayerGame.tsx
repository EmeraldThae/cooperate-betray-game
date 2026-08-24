import React, { useState, useEffect } from 'react';
import { Game, Player, Round, Decision, DecisionType } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { DecisionButtons } from '../components/DecisionButtons';
import { Leaderboard } from '../components/Leaderboard';
import { PairResultsView } from '../components/PairResultsView';
import {
  Shield,
  Zap,
  CheckCircle2,
  Clock,
  Trophy,
  Sparkles,
  Swords,
  Layers,
  Sparkle,
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
  const [activeResultsTab, setActiveResultsTab] = useState<'duel' | 'group' | 'leaderboard'>('duel');

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
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Score</div>
            <div className="font-mono text-xl font-black text-amber-400 leading-none mt-0.5">
              {player.score} <span className="text-xs text-slate-400 font-normal">pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP SECTION: COOPERATE & BETRAY ACTION BUTTONS (Moved to Top for instant mobile access) */}
      {!isRevealed ? (
        <div className="space-y-4 pt-1">
          <div className="text-center space-y-1 max-w-md mx-auto px-2">
            <h3 className="text-lg md:text-2xl font-black text-white">
              {isLocked ? 'Secret Choice Confirmed 🔒' : `Choose Your Action vs ${opponent?.player_name || 'Opponent'}`}
            </h3>
            <p className="text-xs md:text-sm text-slate-400">
              {isLocked
                ? 'Your choice is securely locked on the server. Waiting for Host to reveal results.'
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
        /* Top Banner when Results are Revealed */
        <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/40 text-center space-y-1 animate-fade-in shadow-lg">
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-300 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Round {game.current_round} Results Revealed</span>
          </div>
          <div className="text-sm font-medium text-slate-200">
            You chose <span className={`font-black uppercase ${effectiveDecision === 'cooperate' ? 'text-emerald-400' : 'text-rose-400'}`}>{effectiveDecision || 'no decision'}</span> and earned <span className="font-mono font-black text-amber-400">+{myDuelPoints} pts</span> this round.
          </div>
        </div>
      )}

      {/* 3. MATCH PAIR SECTION (Moved Below Action Buttons, Rule Matrix Removed) */}
      <div className="p-4 md:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-400">
            <Swords className="w-4 h-4 text-rose-400" />
            <span>Match Pair (Round {game.current_round})</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
            {isRevealed ? 'Revealed' : isLocked ? 'Locked' : 'In Progress'}
          </span>
        </div>

        {/* 2-Player Split Screen */}
        <div className="grid grid-cols-5 items-center gap-2 md:gap-4 py-1">
          {/* You (Player 1) */}
          <div className="col-span-2 p-3 md:p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
            <div className="flex items-center gap-2 truncate">
              <span className="text-2xl md:text-3xl">{player.avatar || '🛡️'}</span>
              <div className="truncate">
                <div className="text-[10px] text-indigo-300 font-black uppercase tracking-wider">YOU</div>
                <div className="text-xs md:text-sm font-bold text-white truncate">{player.player_name}</div>
              </div>
            </div>

            <div className="pt-0.5 text-xs">
              {isRevealed ? (
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
              1v1 PAIR
            </div>
          </div>

          {/* Opponent (Player 2) */}
          <div className="col-span-2 p-3 md:p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-right">
            <div className="flex items-center justify-end gap-2 truncate">
              <div className="truncate">
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">OPPONENT</div>
                <div className="text-xs md:text-sm font-bold text-white truncate">
                  {opponent ? opponent.player_name : 'Assigned Partner'}
                </div>
              </div>
              <span className="text-2xl md:text-3xl">{opponent?.avatar || '⚡'}</span>
            </div>

            <div className="pt-0.5 text-xs">
              {isRevealed ? (
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

      {/* 4. RESULTS SECTION (Displayed Below Match Pair when revealed) */}
      {isRevealed && (
        <div className="space-y-5 animate-fade-in">
          {/* Duel Outcome Spotlight Card */}
          <div className="p-5 md:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/90 border border-indigo-500/40 text-xs font-bold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>ROUND {game.current_round} DUEL OUTCOME</span>
            </div>

            <div className="max-w-lg mx-auto space-y-2.5">
              <h3 className="text-xl md:text-2xl font-black text-white">
                {duelCalc.headline}
              </h3>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {duelCalc.description}
              </p>

              {/* Score change badge */}
              <div className="inline-block p-3.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner mt-1">
                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Your Points This Round</div>
                <div className="font-mono text-3xl font-black text-emerald-400 mt-0.5">
                  +{myDuelPoints} <span className="text-base text-slate-400 font-normal">pts</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 pt-1">
              Waiting for Host to advance to the next round...
            </div>
          </div>

          {/* Results Navigation Tabs */}
          <div className="flex items-center justify-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
            <button
              onClick={() => setActiveResultsTab('duel')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeResultsTab === 'duel'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              id="tab-your-duel"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Your 1v1 Duel</span>
            </button>

            <button
              onClick={() => setActiveResultsTab('group')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeResultsTab === 'group'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              id="tab-group-pairs"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Group Pair Results ({activePairings.length || Math.floor(players.length / 2)} Pairs)</span>
            </button>

            <button
              onClick={() => setActiveResultsTab('leaderboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeResultsTab === 'leaderboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              id="tab-leaderboard"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Standings</span>
            </button>
          </div>

          {/* Tab Content Display */}
          {activeResultsTab === 'group' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
              <PairResultsView
                roundNumber={game.current_round}
                pairings={activePairings}
                players={players}
                decisions={decisions}
                highlightPlayerId={player.id}
                isRevealed={true}
              />
            </div>
          )}

          {activeResultsTab === 'leaderboard' && (
            <Leaderboard
              players={players}
              decisions={decisions}
              highlightPlayerId={player.id}
            />
          )}
        </div>
      )}

      {/* 5. Live Standings if round in progress */}
      {!isRevealed && (
        <div className="pt-2">
          <Leaderboard
            players={players}
            decisions={[]}
            highlightPlayerId={player.id}
          />
        </div>
      )}
    </div>
  );
};
