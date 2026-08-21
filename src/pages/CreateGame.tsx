import React, { useState } from 'react';
import { PlusCircle, Clock, Hash, Shield, ArrowLeft, RefreshCw, AlertCircle, Building2 } from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { Game } from '../types';
import { playSound } from '../utils/audio';

interface CreateGameProps {
  onGameCreated: (game: Game, userId: string, hostName?: string) => void;
  onBack: () => void;
}

export const CreateGame: React.FC<CreateGameProps> = ({ onGameCreated, onBack }) => {
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [decisionTime, setDecisionTime] = useState<number>(30);
  const [roomName, setRoomName] = useState<string>('Leadership Workshop');
  const [hostName, setHostName] = useState<string>('Facilitator');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ROUND_OPTIONS = [3, 5, 10, 15, 20];
  const TIME_OPTIONS = [
    { label: '15 sec (High Pressure)', value: 15 },
    { label: '30 sec (Standard)', value: 30 },
    { label: '60 sec (Reflective)', value: 60 },
    { label: '90 sec (Deep Strategy)', value: 90 },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    playSound('click');

    try {
      const { game, userId } = await GameService.createGame({
        totalRounds,
        decisionTimeSeconds: decisionTime,
        roomName: roomName.trim() || 'Corporate Workshop',
      });

      onGameCreated(game, userId, hostName.trim());
    } catch (err: any) {
      setError(err?.message || 'Failed to create game room. Please check your connection.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 md:py-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-xs uppercase tracking-widest font-bold text-indigo-400">Host Console</div>
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Create New Session</h2>
          <p className="text-sm text-slate-400 mt-1">Configure your corporate training room parameters.</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Room Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              Room / Workshop Name
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. IT Team Retreat - Q3"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-medium text-sm transition"
              maxLength={40}
            />
          </div>

          {/* Host Display Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Host Display Title
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. Facilitator, Lead Trainer"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-medium text-sm transition"
              maxLength={30}
            />
          </div>

          {/* Total Rounds */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              Total Number of Rounds
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ROUND_OPTIONS.map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setTotalRounds(num)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition border ${
                    totalRounds === num
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Decision Time */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              Decision Time Limit per Round
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIME_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setDecisionTime(opt.value)}
                  className={`p-3 rounded-xl text-left text-xs font-semibold transition border ${
                    decisionTime === opt.value
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-white">{opt.value} Seconds</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            id="btn-create-game-submit"
          >
            {isCreating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Creating Session & Generating Code...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5" />
                <span>LAUNCH GAME ROOM</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
