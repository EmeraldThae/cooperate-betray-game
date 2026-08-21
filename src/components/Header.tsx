import React, { useState, useEffect } from 'react';
import { Shield, Volume2, VolumeX, HelpCircle, Database, LogOut, Tv } from 'lucide-react';
import { isAudioEnabled, setAudioEnabled } from '../utils/audio';
import { getActiveBackendMode } from '../supabase/serviceAdapter';

interface HeaderProps {
  onOpenRules: () => void;
  onOpenSupabaseSetup: () => void;
  onTogglePresenter?: () => void;
  isPresenter?: boolean;
  onExitGame?: () => void;
  roomCode?: string;
  role?: 'host' | 'player' | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRules,
  onOpenSupabaseSetup,
  onTogglePresenter,
  isPresenter = false,
  onExitGame,
  roomCode,
  role,
}) => {
  const [audioOn, setAudioOn] = useState(isAudioEnabled());
  const [backendMode, setBackendMode] = useState<'server' | 'supabase' | 'demo'>('server');

  useEffect(() => {
    setBackendMode(getActiveBackendMode());
    const handleModeChange = () => setBackendMode(getActiveBackendMode());
    window.addEventListener('tb_mode_changed', handleModeChange);
    return () => window.removeEventListener('tb_mode_changed', handleModeChange);
  }, []);

  const toggleSound = () => {
    const next = !audioOn;
    setAudioEnabled(next);
    setAudioOn(next);
  };

  return (
    <header className="w-full bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div 
          onClick={onExitGame}
          className="flex items-center gap-2.5 cursor-pointer group"
          id="brand-logo"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-rose-600 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
            </div>
          </div>
          <div>
            <span className="text-base font-black tracking-wider text-white">
              COOPERATE <span className="text-rose-500">&</span> BETRAY
            </span>
            <span className="hidden md:inline-block ml-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
              Corporate Edition
            </span>
          </div>
        </div>

        {/* Room Code Badge if inside game */}
        {roomCode && (
          <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs">
            <span className="text-slate-400">ROOM:</span>
            <span className="text-amber-400 font-bold tracking-wider">{roomCode}</span>
            {role && (
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                role === 'host' ? 'bg-purple-900/60 text-purple-300 border border-purple-600/40' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40'
              }`}>
                {role}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Backend Indicator */}
        <button
          onClick={onOpenSupabaseSetup}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
            backendMode === 'supabase'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/60'
              : backendMode === 'server'
              ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/60'
              : 'bg-amber-950/60 text-amber-300 border-amber-500/30 hover:bg-amber-900/60'
          }`}
          title="Configure Supabase Database or Real-Time Multi-Device Sync"
          id="btn-backend-indicator"
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {backendMode === 'supabase' ? 'Supabase Connected' : backendMode === 'server' ? 'Live Cross-Device' : 'Demo Sandbox'}
          </span>
        </button>

        {/* Presenter Mode Toggle for Host */}
        {role === 'host' && onTogglePresenter && (
          <button
            onClick={onTogglePresenter}
            className={`p-2 rounded-lg transition border ${
              isPresenter 
                ? 'bg-indigo-600 text-white border-indigo-400' 
                : 'text-slate-300 hover:text-white bg-slate-800/80 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Big-Screen Workshop Projector Mode"
            id="btn-toggle-presenter"
          >
            <Tv className="w-4 h-4" />
          </button>
        )}

        {/* Sound Toggle */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition"
          title={audioOn ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          id="btn-toggle-audio"
        >
          {audioOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>

        {/* Rules Button */}
        <button
          onClick={onOpenRules}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
          id="btn-header-rules"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Rules Matrix</span>
        </button>

        {/* Exit Room if active */}
        {onExitGame && (
          <button
            onClick={onExitGame}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-800/60 border border-slate-700 hover:bg-rose-950/40 hover:border-rose-800/50 transition"
            title="Leave Session"
            id="btn-leave-session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
