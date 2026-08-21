import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface Game {
  id: string;
  game_code: string;
  host_user_id: string;
  status: 'lobby' | 'round_active' | 'results' | 'completed';
  current_round: number;
  total_rounds: number;
  decision_time_seconds: number;
  room_name: string;
  created_at: string;
  updated_at: string;
}

interface Player {
  id: string;
  game_id: string;
  user_id: string;
  player_name: string;
  score: number;
  status: 'waiting' | 'ready' | 'playing' | 'submitted' | 'completed';
  avatar?: string;
  joined_at: string;
  last_seen_at?: string;
}

interface Round {
  id: string;
  game_id: string;
  round_number: number;
  status: 'active' | 'revealed' | 'completed';
  started_at: string;
  ended_at?: string;
  revealed_at?: string;
}

type DecisionType = 'cooperate' | 'betray' | 'no_decision';

interface Decision {
  id: string;
  round_id: string;
  player_id: string;
  decision: DecisionType;
  points: number;
  submitted_at: string;
}

// In-Memory Game Store
const games = new Map<string, Game>();
const players = new Map<string, Player[]>();
const rounds = new Map<string, Round[]>();
const decisions = new Map<string, Decision[]>();
const sseClients = new Map<string, Set<Response>>();

function generateGameCode(): string {
  const allowedChars = '2346789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * allowedChars.length);
    randomPart += allowedChars[idx];
  }
  return `TB-${randomPart}`;
}

function normalizeGameCode(code: string): string {
  let cleaned = (code || '').toUpperCase().replace(/[\s\-_]+/g, '').trim();
  if (cleaned.startsWith('TB')) {
    cleaned = cleaned.substring(2);
  }
  return `TB-${cleaned}`;
}

function broadcastGameUpdate(gameId: string) {
  const clients = sseClients.get(gameId);
  if (!clients || clients.size === 0) return;

  const game = games.get(gameId);
  const pList = players.get(gameId) || [];
  const rList = rounds.get(gameId) || [];
  const currentRound = game ? rList.find((r) => r.round_number === game.current_round) || null : null;
  const dList = currentRound ? (decisions.get(gameId) || []).filter((d) => d.round_id === currentRound.id) : [];

  const payload = JSON.stringify({
    type: 'UPDATE',
    game,
    players: [...pList].sort((a, b) => b.score - a.score),
    currentRound,
    decisions: dList,
    timestamp: Date.now(),
  });

  clients.forEach((res) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      clients.delete(res);
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', activeGames: games.size });
  });

  // Create Game
  app.post('/api/games', (req: Request, res: Response) => {
    const { totalRounds = 5, decisionTimeSeconds = 30, roomName = 'Corporate Dilemma Lab' } = req.body || {};
    const gameId = 'game_' + Math.random().toString(36).substring(2, 10);
    const userId = 'host_' + Math.random().toString(36).substring(2, 9);
    const code = generateGameCode();
    const now = new Date().toISOString();

    const game: Game = {
      id: gameId,
      game_code: code,
      host_user_id: userId,
      status: 'lobby',
      current_round: 0,
      total_rounds: Number(totalRounds) || 5,
      decision_time_seconds: Number(decisionTimeSeconds) || 30,
      room_name: roomName,
      created_at: now,
      updated_at: now,
    };

    games.set(gameId, game);
    players.set(gameId, []);
    rounds.set(gameId, []);
    decisions.set(gameId, []);

    res.json({ game, userId });
  });

  // Join Game by Code
  app.post('/api/games/join', (req: Request, res: Response) => {
    const { gameCode, playerName, avatar = '🛡️', userId: reqUserId } = req.body || {};

    if (!gameCode || !playerName) {
      res.status(400).json({ error: 'Game Code and Player Name are required.' });
      return;
    }

    const normalizedCode = normalizeGameCode(gameCode);
    let targetGame: Game | undefined;

    for (const g of games.values()) {
      if (normalizeGameCode(g.game_code) === normalizedCode) {
        targetGame = g;
        break;
      }
    }

    if (!targetGame) {
      res.status(404).json({ error: `Game code "${gameCode.toUpperCase()}" not found. Please check your room code.` });
      return;
    }

    if (targetGame.status === 'completed') {
      res.status(400).json({ error: 'This training session has already concluded.' });
      return;
    }

    const currentPlayers = players.get(targetGame.id) || [];
    const userId = reqUserId || 'user_' + Math.random().toString(36).substring(2, 9);
    const trimmedName = String(playerName).trim();

    // Check name conflict with other user
    const conflict = currentPlayers.find(
      (p) => p.player_name.toLowerCase() === trimmedName.toLowerCase() && p.user_id !== userId
    );
    if (conflict) {
      res.status(400).json({ error: `The name "${trimmedName}" is already taken by another participant.` });
      return;
    }

    let existingSelf = currentPlayers.find((p) => p.user_id === userId);
    let playerObj: Player;

    if (existingSelf) {
      existingSelf.player_name = trimmedName;
      existingSelf.avatar = avatar;
      existingSelf.last_seen_at = new Date().toISOString();
      playerObj = existingSelf;
    } else {
      playerObj = {
        id: 'player_' + Math.random().toString(36).substring(2, 10),
        game_id: targetGame.id,
        user_id: userId,
        player_name: trimmedName,
        score: 0,
        status: targetGame.status === 'round_active' ? 'playing' : 'waiting',
        avatar,
        joined_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      currentPlayers.push(playerObj);
      players.set(targetGame.id, currentPlayers);
    }

    broadcastGameUpdate(targetGame.id);
    res.json({ game: targetGame, player: playerObj, userId });
  });

  // Get Game Details
  app.get('/api/games/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }

    const pList = players.get(gameId) || [];
    const rList = rounds.get(gameId) || [];
    const currentRound = rList.find((r) => r.round_number === game.current_round) || null;
    const dList = currentRound ? (decisions.get(gameId) || []).filter((d) => d.round_id === currentRound.id) : [];

    res.json({
      game,
      players: [...pList].sort((a, b) => b.score - a.score),
      currentRound,
      decisions: dList,
    });
  });

  // Start Round
  app.post('/api/games/:gameId/start-round', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundNumber } = req.body || {};
    const game = games.get(gameId);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const now = new Date().toISOString();
    const rNum = Number(roundNumber) || (game.current_round + 1);

    game.status = 'round_active';
    game.current_round = rNum;
    game.updated_at = now;

    // Reset players to playing
    const pList = players.get(gameId) || [];
    pList.forEach((p) => {
      p.status = 'playing';
    });

    const rList = rounds.get(gameId) || [];
    let round = rList.find((r) => r.round_number === rNum);
    if (!round) {
      round = {
        id: 'round_' + Math.random().toString(36).substring(2, 10),
        game_id: gameId,
        round_number: rNum,
        status: 'active',
        started_at: now,
      };
      rList.push(round);
    } else {
      round.status = 'active';
      round.started_at = now;
      round.revealed_at = undefined;
      round.ended_at = undefined;
    }
    rounds.set(gameId, rList);

    broadcastGameUpdate(gameId);
    res.json(round);
  });

  // Submit Decision
  app.post('/api/games/:gameId/decisions', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundId, playerId, decision } = req.body || {};

    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const dList = decisions.get(gameId) || [];
    let existing = dList.find((d) => d.round_id === roundId && d.player_id === playerId);
    const now = new Date().toISOString();

    if (existing) {
      existing.decision = decision as DecisionType;
      existing.submitted_at = now;
    } else {
      existing = {
        id: 'dec_' + Math.random().toString(36).substring(2, 10),
        round_id: roundId,
        player_id: playerId,
        decision: decision as DecisionType,
        points: 0,
        submitted_at: now,
      };
      dList.push(existing);
    }
    decisions.set(gameId, dList);

    // Mark player as submitted
    const pList = players.get(gameId) || [];
    const player = pList.find((p) => p.id === playerId);
    if (player) {
      player.status = 'submitted';
    }

    broadcastGameUpdate(gameId);
    res.json(existing);
  });

  // Reveal Round Results
  app.post('/api/games/:gameId/reveal', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundId } = req.body || {};

    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const rList = rounds.get(gameId) || [];
    const round = rList.find((r) => r.id === roundId);
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }

    const pList = players.get(gameId) || [];
    const dList = decisions.get(gameId) || [];
    const now = new Date().toISOString();

    // Auto-fill missing decisions with no_decision
    pList.forEach((p) => {
      if (!dList.some((d) => d.round_id === roundId && d.player_id === p.id)) {
        dList.push({
          id: 'dec_' + Math.random().toString(36).substring(2, 10),
          round_id: roundId,
          player_id: p.id,
          decision: 'no_decision',
          points: 0,
          submitted_at: now,
        });
      }
    });

    const roundDecs = dList.filter((d) => d.round_id === roundId);
    const validDecs = roundDecs.filter((d) => d.decision !== 'no_decision');
    const coopCount = validDecs.filter((d) => d.decision === 'cooperate').length;
    const betrayCount = validDecs.filter((d) => d.decision === 'betray').length;

    roundDecs.forEach((dec) => {
      let pts = 0;
      if (dec.decision === 'no_decision') {
        pts = 0;
      } else if (betrayCount === 0 && coopCount > 0) {
        pts = 3;
      } else if (coopCount === 0 && betrayCount > 0) {
        pts = 1;
      } else {
        pts = dec.decision === 'betray' ? 5 : 0;
      }
      dec.points = pts;

      if (round.status !== 'revealed' && round.status !== 'completed') {
        const player = pList.find((p) => p.id === dec.player_id);
        if (player) {
          player.score += pts;
          player.status = 'ready';
        }
      }
    });

    round.status = 'revealed';
    round.revealed_at = now;
    round.ended_at = now;
    game.status = 'results';
    game.updated_at = now;

    decisions.set(gameId, dList);
    broadcastGameUpdate(gameId);

    res.json({ success: true, roundId });
  });

  // Complete Game
  app.post('/api/games/:gameId/complete', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const now = new Date().toISOString();
    game.status = 'completed';
    game.updated_at = now;

    const pList = players.get(gameId) || [];
    pList.forEach((p) => {
      p.status = 'completed';
    });

    broadcastGameUpdate(gameId);
    res.json({ success: true });
  });

  // Reset Game to Lobby
  app.post('/api/games/:gameId/reset', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const now = new Date().toISOString();
    game.status = 'lobby';
    game.current_round = 0;
    game.updated_at = now;

    rounds.set(gameId, []);
    decisions.set(gameId, []);

    const pList = players.get(gameId) || [];
    pList.forEach((p) => {
      p.score = 0;
      p.status = 'waiting';
    });

    broadcastGameUpdate(gameId);
    res.json({ success: true });
  });

  // Simulated Player (Bot)
  app.post('/api/games/:gameId/simulated-player', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { name, avatar = '🤖' } = req.body || {};
    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const pList = players.get(gameId) || [];
    const botPlayer: Player = {
      id: 'bot_' + Math.random().toString(36).substring(2, 9),
      game_id: gameId,
      user_id: 'bot_user_' + Math.random().toString(36).substring(2, 9),
      player_name: name || `Player ${pList.length + 1}`,
      score: 0,
      status: game.status === 'round_active' ? 'playing' : 'waiting',
      avatar,
      joined_at: new Date().toISOString(),
    };
    pList.push(botPlayer);
    players.set(gameId, pList);

    broadcastGameUpdate(gameId);
    res.json(botPlayer);
  });

  // Auto-submit bots
  app.post('/api/games/:gameId/auto-bots', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundId } = req.body || {};
    const game = games.get(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const pList = players.get(gameId) || [];
    const dList = decisions.get(gameId) || [];
    const now = new Date().toISOString();

    pList.forEach((p) => {
      if (p.id.startsWith('bot_')) {
        const hasDec = dList.some((d) => d.round_id === roundId && d.player_id === p.id);
        if (!hasDec) {
          const choice: DecisionType = Math.random() < 0.65 ? 'cooperate' : 'betray';
          dList.push({
            id: 'dec_' + Math.random().toString(36).substring(2, 10),
            round_id: roundId,
            player_id: p.id,
            decision: choice,
            points: 0,
            submitted_at: now,
          });
          p.status = 'submitted';
        }
      }
    });

    decisions.set(gameId, dList);
    broadcastGameUpdate(gameId);
    res.json({ success: true });
  });

  // Server-Sent Events (SSE) for Real-Time Cross-Device Sync
  app.get('/api/games/:gameId/stream', (req: Request, res: Response) => {
    const { gameId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!sseClients.has(gameId)) {
      sseClients.set(gameId, new Set());
    }
    const clients = sseClients.get(gameId)!;
    clients.add(res);

    // Send initial snapshot immediately
    const game = games.get(gameId);
    const pList = players.get(gameId) || [];
    const rList = rounds.get(gameId) || [];
    const currentRound = game ? rList.find((r) => r.round_number === game.current_round) || null : null;
    const dList = currentRound ? (decisions.get(gameId) || []).filter((d) => d.round_id === currentRound.id) : [];

    res.write(
      `data: ${JSON.stringify({
        type: 'SNAPSHOT',
        game,
        players: [...pList].sort((a, b) => b.score - a.score),
        currentRound,
        decisions: dList,
        timestamp: Date.now(),
      })}\n\n`
    );

    // Keep connection alive with heartbeat ping
    const pingInterval = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      clients.delete(res);
    });
  });

  // Vite middleware in dev mode, static files in prod mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cooperate & Betray Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
