import React, { useState } from 'react';
import { LogIn, ArrowLeft, RefreshCw, AlertCircle, Sparkles, User, Hash } from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { AVATAR_OPTIONS, validateGameCode, validatePlayerName } from '../utils/gameLogic';
import { Game, Player } from '../types';
import { playSound } from '../utils/audio';

interface JoinGameProps {
  onGameJoined: (game: Game, player: Player, userId: string) => void;
  onBack: () => void;
  initialCode?: string;
}

export const JoinGame: React.FC<JoinGameProps> = ({ onGameJoined, onBack, initialCode = '' }) => {
  const [gameCode, setGameCode] = useState(initialCode);
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🛡️');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    setGameCode(val);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const codeVal = validateGameCode(gameCode);
    if (!codeVal.valid) {
      setError(codeVal.error || 'Please enter a valid Game Code.');
      return;
    }

    const nameVal = validatePlayerName(playerName);
    if (!nameVal.valid) {
      setError(nameVal.error || 'Please enter a valid Player Name.');
      return;
    }

    setIsJoining(true);
    playSound('click');

    try {
      const { game, player, userId } = await GameService.joinGame(
        codeVal.formatted,
        playerName.trim(),
        selectedAvatar
      );
      onGameJoined(game, player, userId);
    } catch (err: any) {
      setError(err?.message || 'Failed to join game room. Please check the code.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8 md:py-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-xs uppercase tracking-widest font-bold text-emerald-400">Player Access</div>
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Join Training Room</h2>
          <p className="text-sm text-slate-400 mt-1">Enter your room code to participate in the strategic rounds.</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          {/* Game Code */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              Game ID / Room Code
            </label>
            <input
              type="text"
              value={gameCode}
              onChange={handleCodeChange}
              placeholder="e.g. TB-7K4P9"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 focus:outline-none focus:border-indigo-500 font-mono font-bold text-lg tracking-wider transition uppercase"
              maxLength={12}
              required
              id="input-join-game-code"
            />
          </div>

          {/* Player Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Your Name / Alias
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Thae, Aung, Director Smith"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-medium text-sm transition"
              maxLength={24}
              required
              id="input-join-player-name"
            />
          </div>

          {/* Avatar Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Choose Your Persona Avatar
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  type="button"
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  className={`h-11 rounded-xl text-xl flex items-center justify-center transition border ${
                    selectedAvatar === av
                      ? 'bg-indigo-600/30 border-indigo-400 scale-110 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isJoining}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2"
            id="btn-join-room-submit"
          >
            {isJoining ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Connecting to Session...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>ENTER LOBBY</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
