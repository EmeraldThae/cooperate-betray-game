import React from 'react';
import { Player, Decision } from '../types';
import { Trophy, Medal, ArrowUpRight, TrendingUp } from 'lucide-react';

interface LeaderboardProps {
  players: Player[];
  decisions?: Decision[];
  isFinal?: boolean;
  highlightPlayerId?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  decisions = [],
  isFinal = false,
  highlightPlayerId,
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const decisionMap = new Map(decisions.map((d) => [d.player_id, d]));

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white text-base md:text-lg">
            {isFinal ? '🏆 Final Tournament Standings' : 'Current Standings'}
          </h3>
        </div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {players.length} Competitors
        </span>
      </div>

      <div className="space-y-2">
        {sortedPlayers.map((player, idx) => {
          const rank = idx + 1;
          const isHighlight = player.id === highlightPlayerId;
          const playerDec = decisionMap.get(player.id);
          const roundPoints = playerDec?.points;

          let rankBadge = (
            <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-slate-400 flex items-center justify-center font-mono">
              {rank}
            </span>
          );

          if (rank === 1) {
            rankBadge = (
              <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 text-xs font-bold text-amber-300 flex items-center justify-center">
                🥇
              </span>
            );
          } else if (rank === 2) {
            rankBadge = (
              <span className="w-6 h-6 rounded-full bg-slate-300/20 border border-slate-300/50 text-xs font-bold text-slate-200 flex items-center justify-center">
                🥈
              </span>
            );
          } else if (rank === 3) {
            rankBadge = (
              <span className="w-6 h-6 rounded-full bg-amber-700/20 border border-amber-700/50 text-xs font-bold text-amber-600 flex items-center justify-center">
                🥉
              </span>
            );
          }

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                isHighlight
                  ? 'bg-indigo-950/50 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                  : rank === 1
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Left: Rank, Avatar, Name */}
              <div className="flex items-center gap-3 min-w-0">
                {rankBadge}
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base flex-shrink-0">
                  {player.avatar || '🛡️'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                    {player.player_name}
                    {isHighlight && (
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-indigo-500 text-white">
                        YOU
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Round Delta & Total Score */}
              <div className="flex items-center gap-4 text-right flex-shrink-0">
                {roundPoints !== undefined && (
                  <div className="flex items-center gap-0.5 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>+{roundPoints}</span>
                  </div>
                )}

                <div className="w-14">
                  <div className="font-mono text-base font-black text-white">{player.score}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Points</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
