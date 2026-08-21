import React from 'react';
import { Player, Decision } from '../types';
import { Check, Clock, UserCheck, Award, Crown } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  decisions?: Decision[];
  showDecisions?: boolean;
  currentPlayerId?: string;
  hostUserId?: string;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  decisions = [],
  showDecisions = false,
  currentPlayerId,
}) => {
  const decisionMap = new Map(decisions.map((d) => [d.player_id, d]));

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400 font-semibold px-2">
        <span>Participant ({players.length})</span>
        <span>Round Status / Score</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {players.map((player, index) => {
          const isMe = player.id === currentPlayerId;
          const playerDec = decisionMap.get(player.id);
          const hasSubmitted = player.status === 'submitted' || Boolean(playerDec);

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                isMe
                  ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Left: Avatar & Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg flex-shrink-0">
                  {player.avatar || '🛡️'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white truncate">{player.player_name}</span>
                    {index === 0 && player.score > 0 && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    {isMe && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex-shrink-0">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Online</span>
                  </div>
                </div>
              </div>

              {/* Right: Submission Status or Revealed Decision & Score */}
              <div className="flex items-center gap-3 text-right flex-shrink-0">
                {showDecisions && playerDec ? (
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                        playerDec.decision === 'cooperate'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/50'
                          : playerDec.decision === 'betray'
                          ? 'bg-rose-950 text-rose-400 border border-rose-600/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {playerDec.decision}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-indigo-300 mt-0.5">
                      +{playerDec.points} pts
                    </span>
                  </div>
                ) : (
                  <div>
                    {hasSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
                        <Check className="w-3 h-3" /> Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
                        <Clock className="w-3 h-3 text-amber-400 animate-spin" /> Thinking
                      </span>
                    )}
                  </div>
                )}

                <div className="w-12 text-right">
                  <div className="font-mono text-sm font-black text-white">{player.score}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">PTS</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
