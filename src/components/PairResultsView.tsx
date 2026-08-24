import React from 'react';
import { Decision, PairMatchResult, Player, PlayerPairing } from '../types';
import { getPairMatchResults } from '../utils/gameLogic';
import { Swords, Shield, Zap, Clock, Users, Award, Sparkles, AlertCircle } from 'lucide-react';

interface PairResultsViewProps {
  roundNumber: number;
  pairings: PlayerPairing[];
  players: Player[];
  decisions: Decision[];
  highlightPlayerId?: string;
  isRevealed?: boolean;
}

export const PairResultsView: React.FC<PairResultsViewProps> = ({
  roundNumber,
  pairings,
  players,
  decisions,
  highlightPlayerId,
  isRevealed = false,
}) => {
  const matchResults: PairMatchResult[] = getPairMatchResults(
    roundNumber,
    pairings,
    players,
    decisions
  );

  const decMap = new Map<string, Decision>(decisions.map((d) => [d.player_id, d]));
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));

  if (matchResults.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
        <Users className="w-6 h-6 mx-auto mb-2 text-slate-500 opacity-60" />
        No active 2-player pairings generated for this round yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Swords className="w-4 h-4 text-indigo-400" />
          <span>2-Player Group Matchups ({matchResults.length} Pairs)</span>
        </h4>
        <span className="text-[11px] font-semibold text-slate-400">
          Round {roundNumber} {isRevealed ? '• Results' : '• Active'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {matchResults.map((match, idx) => {
          const isMyMatch =
            highlightPlayerId &&
            (match.player1.id === highlightPlayerId || match.player2.id === highlightPlayerId);

          const p1 = playerMap.get(match.player1.id);
          const p2 = playerMap.get(match.player2.id);

          const p1Name = p1?.player_name || match.player1.name;
          const p1Avatar = p1?.avatar || match.player1.avatar || '🛡️';
          const p2Name = p2?.player_name || match.player2.name;
          const p2Avatar = p2?.avatar || match.player2.avatar || '⚡';

          const p1Submitted = p1?.status === 'submitted' || decMap.has(match.player1.id);
          const p2Submitted = p2?.status === 'submitted' || decMap.has(match.player2.id);

          return (
            <div
              key={match.pairing_id || idx}
              className={`p-4 rounded-2xl border transition relative overflow-hidden ${
                isMyMatch
                  ? 'bg-gradient-to-b from-indigo-950/80 to-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500/40'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              {isMyMatch && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-bl-lg">
                  YOUR MATCHUP
                </div>
              )}

              {/* Match Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Pair #{idx + 1}
                </span>

                {isRevealed ? (
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      match.outcome === 'both_cooperate'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : match.outcome === 'both_betray'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                        : match.outcome === 'timeout'
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {match.headline}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>In Progress</span>
                  </span>
                )}
              </div>

              {/* 1v1 Split Card */}
              <div className="grid grid-cols-5 items-center gap-2">
                {/* Player 1 */}
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-lg">{p1Avatar}</span>
                    <span className={`text-xs font-bold truncate ${match.player1.id === highlightPlayerId ? 'text-indigo-300 underline font-black' : 'text-white'}`}>
                      {p1Name}
                    </span>
                  </div>

                  {isRevealed ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      {match.player1.decision === 'cooperate' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          <Shield className="w-3 h-3" /> COOP
                        </span>
                      ) : match.player1.decision === 'betray' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40">
                          <Zap className="w-3 h-3" /> BETRAY
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                          TIMEOUT
                        </span>
                      )}
                      <span className="text-xs font-mono font-black text-white">
                        +{match.player1.points}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-semibold">
                      {p1Submitted ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          🔒 Ready
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          ⏳ Deciding...
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Center VS Indicator */}
                <div className="col-span-1 text-center">
                  <div className="w-7 h-7 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-inner">
                    VS
                  </div>
                </div>

                {/* Player 2 */}
                <div className="col-span-2 space-y-1 text-right">
                  <div className="flex items-center justify-end gap-1.5 truncate">
                    <span className={`text-xs font-bold truncate ${match.player2.id === highlightPlayerId ? 'text-indigo-300 underline font-black' : 'text-white'}`}>
                      {p2Name}
                    </span>
                    <span className="text-lg">{p2Avatar}</span>
                  </div>

                  {isRevealed ? (
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <span className="text-xs font-mono font-black text-white">
                        +{match.player2.points}
                      </span>
                      {match.player2.decision === 'cooperate' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                          <Shield className="w-3 h-3" /> COOP
                        </span>
                      ) : match.player2.decision === 'betray' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40">
                          <Zap className="w-3 h-3" /> BETRAY
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                          TIMEOUT
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] font-semibold">
                      {p2Submitted ? (
                        <span className="text-emerald-400 flex items-center justify-end gap-1">
                          🔒 Ready
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center justify-end gap-1">
                          ⏳ Deciding...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Revealed Description Subtext */}
              {isRevealed && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 leading-snug">
                  {match.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
