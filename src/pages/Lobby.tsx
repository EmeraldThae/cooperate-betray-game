import React, { useState } from 'react';
import { Game, Player } from '../types';
import { PlayerList } from '../components/PlayerList';
import { Copy, Check, Play, Users, Clock, ShieldAlert, Sparkles, RefreshCw, Shuffle, Dices, UserPlus, Swords } from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { playSound } from '../utils/audio';

interface LobbyProps {
  game: Game;
  players: Player[];
  role: 'host' | 'player';
  currentPlayerId?: string;
  onStartGame: () => void;
  onRefresh?: () => void;
}

const RANDOM_NAMES = [
  'Alex (Strategy)', 'Taylor (Operations)', 'Jordan (Finance)', 'Morgan (Marketing)',
  'Riley (Engineering)', 'Casey (Design)', 'Sam (Product)', 'Avery (Sales)'
];

const RANDOM_AVATARS = ['🦊', '🦁', '🐺', '🦉', '🚀', '💎', '🛡️', '⚡', '♟️', '🎯'];

export const Lobby: React.FC<LobbyProps> = ({
  game,
  players,
  role,
  currentPlayerId,
  onStartGame,
  onRefresh,
}) => {
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [pairings, setPairings] = useState<Array<[Player, Player]>>([]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(game.game_code);
    setCopied(true);
    playSound('click');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStart = async () => {
    if (role !== 'host') return;
    setIsStarting(true);
    playSound('submit');
    try {
      await GameService.startRound(game.id, 1);
      onStartGame();
    } catch (e) {
      console.error(e);
      setIsStarting(false);
    }
  };

  // Random 2-Player Setup for Host
  const handleRandomTwoPlayerSetup = async () => {
    if (role !== 'host') return;
    setIsRandomizing(true);
    playSound('click');

    try {
      if (players.length < 2) {
        const needed = 2 - players.length;
        const existingNames = new Set(players.map((p) => p.player_name.toLowerCase()));
        const availableNames = RANDOM_NAMES.filter((n) => !existingNames.has(n.toLowerCase()));

        for (let i = 0; i < needed; i++) {
          const name = availableNames[i] || `Player ${players.length + 1 + i}`;
          const avatar = RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)];
          await GameService.addSimulatedPlayer(game.id, name, avatar);
        }
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error during random 2-player setup:', err);
    } finally {
      setIsRandomizing(false);
    }
  };

  // Generate random 2-player pairs for the room
  const handleGeneratePairs = () => {
    if (players.length < 2) return;
    playSound('click');
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const newPairs: Array<[Player, Player]> = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      newPairs.push([shuffled[i], shuffled[i + 1]]);
    }
    setPairings(newPairs);
  };

  const isHost = role === 'host';
  const canStart = players.length >= 2;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Game Code Announcement Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl text-center space-y-4 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ROOM LOBBY ACTIVE</span>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-1">
            Share this Game Code with Participants
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-4xl sm:text-5xl md:text-6xl font-black text-amber-400 tracking-wider">
              {game.game_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold"
              title="Copy Room Code"
              id="btn-copy-room-code"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Room configuration summary */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{players.length} Players Connected</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{game.total_rounds} Strategic Rounds</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>{game.decision_time_seconds}s per Round</span>
          </div>
        </div>
      </div>

      {/* Main Roster & Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Player Roster & 2-Player Matchups */}
        <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Connected Team Roster
            </h3>
            <div className="flex items-center gap-2">
              {isHost && players.length >= 2 && (
                <button
                  onClick={handleGeneratePairs}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 flex items-center gap-1 transition"
                  title="Randomize 2-Player Matchups"
                  id="btn-randomize-pairs"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Random Pairs</span>
                </button>
              )}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  title="Refresh Roster"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* If 2 players are in the room, show direct 1v1 duel banner */}
          {players.length === 2 && (
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{players[0].avatar || '🛡️'}</span>
                <div>
                  <div className="font-bold text-sm text-white">{players[0].player_name}</div>
                  <div className="text-[10px] text-indigo-300 font-semibold uppercase">Player 1</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/30 border border-indigo-500/50 text-indigo-200 text-xs font-black">
                <Swords className="w-3.5 h-3.5 text-rose-400" />
                <span>1v1 MATCHUP</span>
              </div>

              <div className="flex items-center gap-2.5 text-right">
                <div>
                  <div className="font-bold text-sm text-white">{players[1].player_name}</div>
                  <div className="text-[10px] text-indigo-300 font-semibold uppercase">Player 2</div>
                </div>
                <span className="text-2xl">{players[1].avatar || '⚡'}</span>
              </div>
            </div>
          )}

          {/* If pairings have been generated for larger groups */}
          {pairings.length > 0 && players.length > 2 && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-2">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span>Active 2-Player Breakout Pairings</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {pairings.map((pair, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-medium text-slate-200"
                  >
                    <span>{pair[0].avatar} {pair[0].player_name}</span>
                    <span className="text-[10px] font-black text-rose-400 px-1.5 py-0.5 rounded bg-slate-800">VS</span>
                    <span>{pair[1].avatar} {pair[1].player_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <PlayerList
            players={players}
            currentPlayerId={currentPlayerId}
            showDecisions={false}
          />
        </div>

        {/* Right: Facilitator Action or Player Waiting */}
        <div className="md:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-center space-y-4">
            {isHost ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                  <Play className="w-6 h-6 ml-0.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">Host Control</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {canStart
                      ? 'All set! Launch Round 1 when your team is assembled.'
                      : 'At least 2 players are needed to begin the simulation.'}
                  </p>
                </div>

                {/* Host Quick 2-Player Setup Button */}
                {players.length < 2 && (
                  <button
                    onClick={handleRandomTwoPlayerSetup}
                    disabled={isRandomizing}
                    className="w-full py-3 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                    id="btn-random-2p-setup"
                  >
                    {isRandomizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Setting up 2 Players...</span>
                      </>
                    ) : (
                      <>
                        <Dices className="w-4 h-4 text-amber-400" />
                        <span>🎲 Random Setup for 2 Players</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleStart}
                  disabled={!canStart || isStarting}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  id="btn-host-start-game"
                >
                  {isStarting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Starting Session...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>START ROUND 1</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">Ready & Waiting</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Waiting for the Host to start the game. Your screen will transition automatically once the round starts.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick instructions reminder */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Strategic Dilemma Rule
            </div>
            <p>
              Remember: Decisions remain secret until revealed simultaneously by the host. Cooperate for steady collective progress or Betray for high individual risk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
