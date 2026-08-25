import React, { useState, useEffect, useCallback } from 'react';
import {
  LogIn,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Sparkles,
  User,
  Hash,
  Smartphone,
  CheckCircle2,
  Users,
  Clock,
  Radio,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { AVATAR_OPTIONS, validateGameCode, validatePlayerName } from '../utils/gameLogic';
import { Game, Player } from '../types';
import { playSound } from '../utils/audio';

interface JoinGameProps {
  onGameJoined: (game: Game, player: Player, userId: string) => void;
  onBack: () => void;
  initialCode?: string;
}

interface ActiveGameItem {
  id: string;
  game_code: string;
  room_name: string;
  status: string;
  player_count: number;
  total_rounds: number;
  created_at: string;
}

export const JoinGame: React.FC<JoinGameProps> = ({ onGameJoined, onBack, initialCode = '' }) => {
  const [gameCode, setGameCode] = useState(initialCode);
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🛡️');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live verification state
  const [verifying, setVerifying] = useState(false);
  const [verifiedRoom, setVerifiedRoom] = useState<{
    exists: boolean;
    gameCode?: string;
    roomName?: string;
    playerCount?: number;
    totalRounds?: number;
    decisionTimeSeconds?: number;
  } | null>(null);

  // Active rooms on server
  const [activeRooms, setActiveRooms] = useState<ActiveGameItem[]>([]);
  const [loadingActiveRooms, setLoadingActiveRooms] = useState(false);

  // Load active rooms for easy 1-click cross-device joining
  const loadActiveRooms = useCallback(async () => {
    setLoadingActiveRooms(true);
    try {
      const rooms = await GameService.getActiveGames();
      setActiveRooms(rooms || []);
    } catch {
      setActiveRooms([]);
    } finally {
      setLoadingActiveRooms(false);
    }
  }, []);

  useEffect(() => {
    loadActiveRooms();
    const interval = setInterval(loadActiveRooms, 4000);
    return () => clearInterval(interval);
  }, [loadActiveRooms]);

  // Set initial code from URL or prop
  useEffect(() => {
    if (initialCode) {
      const parsed = validateGameCode(initialCode);
      if (parsed.valid) {
        setGameCode(parsed.formatted);
      } else {
        setGameCode(initialCode.toUpperCase().trim());
      }
    }
  }, [initialCode]);

  // Live verify room code as user types
  useEffect(() => {
    const clean = gameCode.trim();
    if (!clean || clean.length < 3) {
      setVerifiedRoom(null);
      setVerifying(false);
      return;
    }

    let isMounted = true;
    setVerifying(true);

    const timer = setTimeout(async () => {
      try {
        const result = await GameService.checkGameCode(clean);
        if (isMounted) {
          if (result && result.exists) {
            setVerifiedRoom(result);
            setError(null);
          } else {
            setVerifiedRoom(null);
          }
        }
      } catch {
        if (isMounted) setVerifiedRoom(null);
      } finally {
        if (isMounted) setVerifying(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [gameCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // If user pasted a URL containing ?code= or ?join= or ?room=
    if (raw.includes('code=') || raw.includes('join=') || raw.includes('room=')) {
      try {
        const urlMatch = raw.match(/[?&](?:code|join|room)=([^&#]+)/i);
        if (urlMatch && urlMatch[1]) {
          raw = decodeURIComponent(urlMatch[1]);
        }
      } catch {
        // Continue with raw text
      }
    }
    setGameCode(raw.toUpperCase().trim());
  };

  const handleSelectActiveRoom = (room: ActiveGameItem) => {
    setGameCode(room.game_code);
    playSound('click');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInput = gameCode.trim();
    if (!cleanInput) {
      setError('Please enter a Game Code (e.g. TB-7K4P9).');
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
        cleanInput,
        playerName.trim(),
        selectedAvatar
      );
      onGameJoined(game, player, userId);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to join game room. Please verify the room code on the host screen and try again.'
      );
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 md:py-10 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            id="btn-join-back"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Menu
          </button>
          <div className="text-xs uppercase tracking-widest font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Smartphone className="w-3.5 h-3.5" /> Mobile & Desktop Ready
          </div>
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Join Training Room</h2>
          <p className="text-sm text-slate-400 mt-1">
            Enter your room code or select an active session on your network.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-3 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">{error}</span>
              <span className="text-[11px] text-rose-300 block">
                Tip: If you're on a mobile phone, scan the host screen's QR code or select from the active rooms below.
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          {/* Game Code Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                Game ID / Room Code
              </label>
              {verifying && (
                <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Verifying...
                </span>
              )}
            </div>

            <input
              type="text"
              value={gameCode}
              onChange={handleCodeChange}
              placeholder="e.g. TB-7K4P9 or 7K4P9"
              className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 focus:outline-none focus:border-indigo-500 font-mono font-black text-xl tracking-wider transition uppercase"
              maxLength={24}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
              id="input-join-game-code"
            />

            {/* Live Room Verification Status */}
            {verifiedRoom && verifiedRoom.exists && (
              <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white">{verifiedRoom.roomName || 'Workshop Room'}</span>
                    <span className="text-[11px] text-emerald-400 ml-1.5 font-mono">({verifiedRoom.gameCode})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span>{verifiedRoom.playerCount ?? 0} in lobby</span>
                  <span>•</span>
                  <span>{verifiedRoom.totalRounds ?? 5} rounds</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-1.5">
              Type the 5 letters or paste the full room URL from the host screen.
            </p>
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
              placeholder="e.g. Alex, Jordan, Taylor"
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
                  className={`h-11 rounded-xl text-xl flex items-center justify-center transition border cursor-pointer ${
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

      {/* Active Live Rooms List for Fast Cross-Device Discovery */}
      {activeRooms.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="font-bold text-sm text-white">Live Rooms on this Network</h3>
            </div>
            <button
              onClick={loadActiveRooms}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              title="Refresh live rooms"
            >
              <RefreshCw className={`w-3 h-3 ${loadingActiveRooms ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Detected active sessions hosted on this server. Click any room to autofill its code:
          </p>

          <div className="space-y-2 pt-1">
            {activeRooms.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelectActiveRoom(r)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  gameCode.toUpperCase().includes(r.game_code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    ? 'bg-indigo-950/60 border-indigo-500/50 shadow-md shadow-indigo-900/30'
                    : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-amber-400 tracking-wider">
                      {r.game_code}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {r.room_name || 'Workshop Session'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-indigo-400" />
                      {r.player_count} player{r.player_count === 1 ? '' : 's'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {r.total_rounds} rounds
                    </span>
                    <span>•</span>
                    <span className="capitalize text-emerald-400">{r.status}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectActiveRoom(r);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition"
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
