import React, { useState, useEffect } from 'react';
import { LogIn, ArrowLeft, RefreshCw, AlertCircle, Sparkles, User, Hash, Smartphone } from 'lucide-react';
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

  useEffect(() => {
    if (initialCode) {
      const parsed = validateGameCode(initialCode);
      if (parsed.valid) {
        setGameCode(parsed.formatted);
      }
    }
  }, [initialCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // If user pasted a URL containing ?code= or ?join=
    if (raw.includes('code=') || raw.includes('join=')) {
      try {
        const urlMatch = raw.match(/[?&](?:code|join)=([^&#]+)/i);
        if (urlMatch && urlMatch[1]) {
          raw = decodeURIComponent(urlMatch[1]);
        }
      } catch {
        // Continue with raw text
      }
    }
    setGameCode(raw.toUpperCase());
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const codeVal = validateGameCode(gameCode);
    if (!codeVal.valid) {
      setError(codeVal.error || 'Please enter a valid Game Code (e.g. TB-7K4P9).');
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
      setError(err?.message || 'Failed to join game room. Please verify the room code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 md:py-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-xs uppercase tracking-widest font-bold text-emerald-400 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" /> Mobile & Desktop Ready
          </div>
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Join Training Room</h2>
          <p className="text-sm text-slate-400 mt-1">Enter your room code to participate from your phone or laptop.</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Could not connect to room:</span>
              <span>{error}</span>
            </div>
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
              placeholder="e.g. TB-7K4P9 or 7K4P9"
              className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 focus:outline-none focus:border-indigo-500 font-mono font-black text-xl tracking-wider transition uppercase"
              maxLength={16}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
              id="input-join-game-code"
            />
            <p className="text-[11px] text-slate-400 mt-1">You can type the 5 letters or the full TB- code.</p>
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
              placeholder="e.g. Thae, Alex, Jordan"
              className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-medium text-base transition"
              maxLength={24}
              autoCapitalize="words"
              autoCorrect="off"
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
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 active:scale-95 cursor-pointer"
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
