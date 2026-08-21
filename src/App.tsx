import React, { useState, useEffect, useCallback } from 'react';
import { Game, Player, Round, Decision, SessionState } from './types';
import { GameService } from './supabase/serviceAdapter';
import { Header } from './components/Header';
import { RulesModal } from './components/RulesModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { PresenterMode } from './components/PresenterMode';
import { MultiPlayerSandbox } from './components/MultiPlayerSandbox';
import { Home } from './pages/Home';
import { CreateGame } from './pages/CreateGame';
import { JoinGame } from './pages/JoinGame';
import { Lobby } from './pages/Lobby';
import { HostDashboard } from './pages/HostDashboard';
import { PlayerGame } from './pages/PlayerGame';
import { FinalSummary } from './pages/FinalSummary';
import { playSound } from './utils/audio';

type ViewMode = 'home' | 'create' | 'join' | 'lobby' | 'host_dashboard' | 'player_game' | 'summary';

const SESSION_STORAGE_KEY = 'trust_betray_session';

export default function App() {
  const [view, setView] = useState<ViewMode>('home');
  const [session, setSession] = useState<SessionState>({
    role: null,
    gameId: null,
    gameCode: null,
    userId: null,
    playerId: null,
    playerName: null,
  });

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [allDecisions, setAllDecisions] = useState<Decision[]>([]);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [isPresenter, setIsPresenter] = useState(false);
  const [joinCodeParam, setJoinCodeParam] = useState<string>('');

  // Check URL query params for auto-join (e.g. ?code=TB-XXXXX or ?join=TB-XXXXX)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code') || params.get('join') || params.get('room');
      if (urlCode) {
        setJoinCodeParam(urlCode.trim());
        setView('join');
      }
    } catch {
      // Ignore URL parsing failure
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: SessionState = JSON.parse(raw);
        if (parsed.gameId) {
          setSession(parsed);
          loadGameDetails(parsed.gameId, parsed.role);
        }
      } catch (e) {
        console.error('Failed to parse saved session:', e);
      }
    }
  }, []);

  const saveSession = (newSession: SessionState) => {
    setSession(newSession);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession({
      role: null,
      gameId: null,
      gameCode: null,
      userId: null,
      playerId: null,
      playerName: null,
    });
    setGame(null);
    setPlayers([]);
    setCurrentRound(null);
    setDecisions([]);
    setView('home');
    setIsPresenter(false);
  };

  const loadGameDetails = useCallback(async (gameId: string, roleHint?: 'host' | 'player' | null) => {
    try {
      const details = await GameService.getGameDetails(gameId);
      setGame(details.game);
      setPlayers(details.players);
      setCurrentRound(details.currentRound);
      setDecisions(details.decisions);

      // Determine correct view based on game status & role
      const effectiveRole = roleHint || session.role;
      if (details.game.status === 'completed') {
        setView('summary');
      } else if (details.game.status === 'lobby') {
        setView('lobby');
      } else {
        if (effectiveRole === 'host') {
          setView('host_dashboard');
        } else {
          setView('player_game');
        }
      }
    } catch (e) {
      console.error('Failed to load game details:', e);
    }
  }, [session.role]);

  // Set up real-time subscription whenever active gameId is present
  useEffect(() => {
    if (!session.gameId) return;

    const unsubscribe = GameService.subscribeToGame(session.gameId, {
      onGameUpdate: (updatedGame) => {
        setGame(updatedGame);
        if (updatedGame.status === 'completed') {
          setView('summary');
        } else if (updatedGame.status === 'lobby') {
          setView('lobby');
        } else if (session.role === 'host') {
          setView('host_dashboard');
        } else if (session.role === 'player') {
          setView('player_game');
        }
      },
      onPlayersUpdate: (updatedPlayers) => {
        setPlayers(updatedPlayers);
      },
      onRoundUpdate: (updatedRound) => {
        setCurrentRound(updatedRound);
      },
      onDecisionsUpdate: (updatedDecisions) => {
        setDecisions(updatedDecisions);
        setAllDecisions((prev) => {
          const map = new Map(prev.map((d) => [d.id, d]));
          updatedDecisions.forEach((d) => map.set(d.id, d));
          return Array.from(map.values());
        });
      },
    });

    return () => {
      unsubscribe();
    };
  }, [session.gameId, session.role]);

  const handleGameCreated = (newGame: Game, userId: string, hostName: string = 'Facilitator') => {
    saveSession({
      role: 'host',
      gameId: newGame.id,
      gameCode: newGame.game_code,
      userId,
      playerId: null,
      playerName: hostName,
    });
    setGame(newGame);
    setPlayers([]);
    setView('lobby');
  };

  const handleGameJoined = (joinedGame: Game, player: Player, userId: string) => {
    saveSession({
      role: 'player',
      gameId: joinedGame.id,
      gameCode: joinedGame.game_code,
      userId,
      playerId: player.id,
      playerName: player.player_name,
    });
    setGame(joinedGame);
    setPlayers((prev) => (prev.some((p) => p.id === player.id) ? prev : [...prev, player]));

    if (joinedGame.status === 'lobby') {
      setView('lobby');
    } else if (joinedGame.status === 'completed') {
      setView('summary');
    } else {
      setView('player_game');
    }
  };

  // Instant 4-player demo setup
  const handleLaunchQuickDemo = async () => {
    playSound('click');
    try {
      const { game: demoGame, userId } = await GameService.createGame({
        totalRounds: 5,
        decisionTimeSeconds: 30,
        roomName: 'Instant Leadership Sandbox',
      });

      // Add Host as player 1
      const p1 = await GameService.addSimulatedPlayer(demoGame.id, 'You (Host)', '🛡️');
      await GameService.addSimulatedPlayer(demoGame.id, 'Aung', '🦁');
      await GameService.addSimulatedPlayer(demoGame.id, 'Su Su', '🐺');
      await GameService.addSimulatedPlayer(demoGame.id, 'Mg Mg', '🦉');

      saveSession({
        role: 'host',
        gameId: demoGame.id,
        gameCode: demoGame.game_code,
        userId,
        playerId: p1.id,
        playerName: 'Host Facilitator',
      });

      setGame(demoGame);
      await loadGameDetails(demoGame.id, 'host');
      setView('lobby');
    } catch (e) {
      console.error('Failed to launch quick demo:', e);
    }
  };

  const handleStartGame = () => {
    if (session.role === 'host') {
      setView('host_dashboard');
    } else {
      setView('player_game');
    }
  };

  const currentPlayer = players.find((p) => p.id === session.playerId) || players[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top App Header */}
      <Header
        onOpenRules={() => setRulesOpen(true)}
        onOpenSupabaseSetup={() => setSetupOpen(true)}
        onTogglePresenter={() => setIsPresenter(!isPresenter)}
        isPresenter={isPresenter}
        onExitGame={session.gameId ? clearSession : undefined}
        roomCode={game?.game_code}
        role={session.role}
      />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 w-full">
        {view === 'home' && (
          <Home
            onCreateGame={() => setView('create')}
            onJoinGame={() => setView('join')}
            onOpenRules={() => setRulesOpen(true)}
            onQuickDemo={handleLaunchQuickDemo}
          />
        )}

        {view === 'create' && (
          <CreateGame
            onGameCreated={handleGameCreated}
            onBack={() => setView('home')}
          />
        )}

        {view === 'join' && (
          <JoinGame
            initialCode={joinCodeParam}
            onGameJoined={handleGameJoined}
            onBack={() => setView('home')}
          />
        )}

        {view === 'lobby' && game && (
          <Lobby
            game={game}
            players={players}
            role={session.role || 'player'}
            currentPlayerId={session.playerId || undefined}
            onStartGame={handleStartGame}
            onRefresh={() => loadGameDetails(game.id)}
          />
        )}

        {view === 'host_dashboard' && game && (
          <HostDashboard
            game={game}
            players={players}
            currentRound={currentRound}
            decisions={decisions}
            onRefresh={() => loadGameDetails(game.id)}
            onGameCompleted={() => setView('summary')}
            onTogglePresenter={() => setIsPresenter(true)}
          />
        )}

        {view === 'player_game' && game && currentPlayer && (
          <PlayerGame
            game={game}
            player={currentPlayer}
            players={players}
            currentRound={currentRound}
            decisions={decisions}
            onRefresh={() => loadGameDetails(game.id)}
          />
        )}

        {view === 'summary' && game && (
          <FinalSummary
            game={game}
            players={players}
            allDecisions={allDecisions.length > 0 ? allDecisions : decisions}
            role={session.role || 'player'}
            currentPlayerId={session.playerId || undefined}
            onResetGame={() => {
              GameService.resetGame(game.id);
              setView('lobby');
            }}
            onHome={clearSession}
          />
        )}
      </main>

      {/* Floating Facilitator Sandbox helper */}
      {game && (view === 'lobby' || view === 'host_dashboard' || view === 'player_game') && (
        <MultiPlayerSandbox
          game={game}
          players={players}
          currentRound={currentRound}
          onRefresh={() => loadGameDetails(game.id)}
        />
      )}

      {/* Presenter Projector Overlay */}
      {isPresenter && game && (
        <PresenterMode
          game={game}
          players={players}
          currentRound={currentRound}
          decisions={decisions}
          onExitPresenter={() => setIsPresenter(false)}
          onReveal={
            currentRound && currentRound.status !== 'revealed'
              ? () => GameService.revealResults(currentRound.id, game.id)
              : undefined
          }
          onNextRound={
            currentRound?.status === 'revealed' && game.current_round < game.total_rounds
              ? () => GameService.startRound(game.id, game.current_round + 1)
              : undefined
          }
        />
      )}

      {/* Rules Briefing Modal */}
      <RulesModal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
      />

      {/* Supabase Setup / Architecture Modal */}
      <SupabaseSetupModal
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
      />
    </div>
  );
}
