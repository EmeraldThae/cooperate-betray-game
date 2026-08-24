import React, { useState } from 'react';
import { Bot, UserPlus, PlayCircle, Eye, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { GameService } from '../supabase/serviceAdapter';
import { Game, Player, Round } from '../types';

interface MultiPlayerSandboxProps {
  game: Game;
  players: Player[];
  currentRound: Round | null;
  onRefresh?: () => void;
}

const SAMPLE_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Sam', 'Avery', 'Devon', 'Quinn'];

export const MultiPlayerSandbox: React.FC<MultiPlayerSandboxProps> = ({
  game,
  players,
  currentRound,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddBot = async () => {
    setIsAdding(true);
    const existingNames = new Set(players.map((p) => p.player_name.toLowerCase()));
    const availableNames = SAMPLE_NAMES.filter((n) => !existingNames.has(n.toLowerCase()));
    const botName = availableNames[0] || `Colleague ${players.length + 1}`;
    const avatars = ['🤖', '🦁', '🐺', '🦊', '🦉', '♟️'];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];

    try {
      await GameService.addSimulatedPlayer(game.id, botName, avatar);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAutoSubmitAll = async () => {
    if (!currentRound) return;
    try {
      await GameService.autoSubmitBots(currentRound.id, game.id);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFourBots = async () => {
    setIsAdding(true);
    for (let i = 0; i < 3; i++) {
      const existingNames = new Set(players.map((p) => p.player_name.toLowerCase()));
      const availableNames = SAMPLE_NAMES.filter((n) => !existingNames.has(n.toLowerCase()));
      const botName = availableNames[0] || `Player ${players.length + 1 + i}`;
      await GameService.addSimulatedPlayer(game.id, botName, '🤖');
    }
    if (onRefresh) onRefresh();
    setIsAdding(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {isOpen ? (
        <div className="w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 text-slate-100 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>Multiplayer Test Helper</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Test multi-user rounds instantly by spawning simulated team members:
          </p>

          <div className="space-y-2">
            <button
              onClick={handleAddBot}
              disabled={isAdding}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-2 transition border border-slate-700"
              id="btn-sandbox-add-bot"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              + Add 1 Simulated Player
            </button>

            {players.length < 3 && (
              <button
                onClick={handleAddFourBots}
                disabled={isAdding}
                className="w-full py-2 px-3 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-xs font-semibold text-indigo-200 flex items-center justify-center gap-2 transition border border-indigo-700/50"
                id="btn-sandbox-add-team"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Fill Room with 3 Team Members
              </button>
            )}

            {game.status === 'round_active' && currentRound && (
              <button
                onClick={handleAutoSubmitAll}
                className="w-full py-2 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-xs font-semibold text-emerald-200 flex items-center justify-center gap-2 transition border border-emerald-700/50"
                id="btn-sandbox-auto-submit"
              >
                <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Submit Decisions for Bots
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold shadow-xl hover:bg-slate-800 transition"
          id="btn-open-sandbox"
        >
          <Bot className="w-4 h-4" />
          <span>Test Sandbox ({players.length} Players)</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
