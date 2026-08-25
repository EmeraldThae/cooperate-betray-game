import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

interface PlayerPairing {
  id: string;
  round_number?: number;
  player1_id: string;
  player2_id: string;
}

interface Game {
  id: string;
  game_code: string;
  host_user_id: string;
  status: 'lobby' | 'round_active' | 'results' | 'completed';
  current_round: number;
  total_rounds: number;
  decision_time_seconds: number;
  room_name: string;
  current_pairings?: PlayerPairing[];
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
  pairings?: PlayerPairing[];
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

interface DatabaseStore {
  games: Record<string, Game>;
  players: Record<string, Player[]>;
  rounds: Record<string, Round[]>;
  decisions: Record<string, Decision[]>;
}

// Persistent Storage Setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gamestore.json');

function ensureDataFile(): DatabaseStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        games: parsed.games || {},
        players: parsed.players || {},
        rounds: parsed.rounds || {},
        decisions: parsed.decisions || {},
      };
    }
  } catch (err) {
    console.error('Error reading persistent store, creating fresh one:', err);
  }
  return { games: {}, players: {}, rounds: {}, decisions: {} };
}

const initialStore = ensureDataFile();
const games = new Map<string, Game>(Object.entries(initialStore.games));
const players = new Map<string, Player[]>(Object.entries(initialStore.players));
const rounds = new Map<string, Round[]>(Object.entries(initialStore.rounds));
const decisions = new Map<string, Decision[]>(Object.entries(initialStore.decisions));
const sseClients = new Map<string, Set<Response>>();

function saveStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const store: DatabaseStore = {
      games: Object.fromEntries(games.entries()),
      players: Object.fromEntries(players.entries()),
      rounds: Object.fromEntries(rounds.entries()),
      decisions: Object.fromEntries(decisions.entries()),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store to disk:', err);
  }
}

function generatePairings(playerList: Player[], roundNumber: number = 1): PlayerPairing[] {
  if (playerList.length < 2) return [];
  const shuffled = [...playerList].sort(() => 0.5 - Math.random());
  const pairs: PlayerPairing[] = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push({
      id: `pair_${roundNumber}_${Math.random().toString(36).substring(2, 8)}`,
      round_number: roundNumber,
      player1_id: shuffled[i].id,
      player2_id: shuffled[i + 1].id,
    });
  }
  if (shuffled.length % 2 !== 0 && shuffled.length >= 3) {
    // Pair odd player with the first player
    pairs.push({
      id: `pair_${roundNumber}_odd_${Math.random().toString(36).substring(2, 8)}`,
      round_number: roundNumber,
      player1_id: shuffled[shuffled.length - 1].id,
      player2_id: shuffled[0].id,
    });
  }
  return pairs;
}

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
  let cleaned = (code || '').trim();
  // If user pasted a full URL or query string
  if (cleaned.includes('code=') || cleaned.includes('join=') || cleaned.includes('room=')) {
    const match = cleaned.match(/[?&](?:code|join|room)=([^&#\s]+)/i);
    if (match && match[1]) {
      cleaned = decodeURIComponent(match[1]);
    }
  }
  cleaned = cleaned.toUpperCase().replace(/[\s\-_#]+/g, '').trim();
  if (cleaned.startsWith('TB')) {
    cleaned = cleaned.substring(2);
  }
  return `TB-${cleaned}`;
}

function findGameByCode(inputCode: string): Game | undefined {
  if (!inputCode) return undefined;
  const rawInput = inputCode.trim();
  const targetNorm = normalizeGameCode(rawInput);
  const plainTarget = targetNorm.replace('TB-', '').toUpperCase();

  // Search in memory
  for (const g of games.values()) {
    const gNorm = normalizeGameCode(g.game_code);
    const gPlain = gNorm.replace('TB-', '').toUpperCase();
    if (
      g.id.toLowerCase() === rawInput.toLowerCase() ||
      g.game_code.toUpperCase() === rawInput.toUpperCase() ||
      gNorm === targetNorm ||
      gPlain === plainTarget
    ) {
      return g;
    }
  }

  // If not found in memory, reload from disk in case of fresh process
  try {
    const diskStore = ensureDataFile();
    for (const [id, g] of Object.entries(diskStore.games)) {
      const gNorm = normalizeGameCode(g.game_code);
      const gPlain = gNorm.replace('TB-', '').toUpperCase();
      if (
        g.id.toLowerCase() === rawInput.toLowerCase() ||
        g.game_code.toUpperCase() === rawInput.toUpperCase() ||
        gNorm === targetNorm ||
        gPlain === plainTarget
      ) {
        games.set(id, g);
        if (diskStore.players[id]) players.set(id, diskStore.players[id]);
        if (diskStore.rounds[id]) rounds.set(id, diskStore.rounds[id]);
        if (diskStore.decisions[id]) decisions.set(id, diskStore.decisions[id]);
        return g;
      }
    }
  } catch (err) {
    console.error('Error checking disk store in findGameByCode:', err);
  }

  return undefined;
}

function broadcastGameUpdate(gameId: string) {
  const clients = sseClients.get(gameId);
  if (!clients || clients.size === 0) return;

  const game = games.get(gameId);
  const pList = players.get(gameId) || [];
  const rList = rounds.get(gameId) || [];
  const currentRound = game ? rList.find((r) => r.round_number === game.current_round) || null : null;
  const dList = currentRound ? (decisions.get(gameId) || []).filter((d) => d.round_id === currentRound.id) : [];

  const allDList = decisions.get(gameId) || [];

  const payload = JSON.stringify({
    type: 'UPDATE',
    game,
    players: [...pList].sort((a, b) => b.score - a.score),
    currentRound,
    decisions: dList,
    rounds: rList,
    allDecisions: allDList,
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

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Enable CORS headers for API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check & stats
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      activeGames: games.size,
      allGameCodes: Array.from(games.values()).map((g) => g.game_code),
    });
  });

  // Check code availability / details
  app.get('/api/games/check/:gameCode', (req: Request, res: Response) => {
    const { gameCode } = req.params;
    const targetGame = findGameByCode(gameCode);
    if (!targetGame) {
      res.status(404).json({ exists: false, error: `Game code "${gameCode.toUpperCase()}" was not found.` });
      return;
    }
    const currentPlayers = players.get(targetGame.id) || [];
    res.json({
      exists: true,
      gameCode: targetGame.game_code,
      status: targetGame.status,
      roomName: targetGame.room_name,
      playerCount: currentPlayers.length,
    });
  });

  // Create Game
  app.post('/api/games', (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const totalRounds = Number(body.totalRounds) || 5;
      const decisionTimeSeconds = Number(body.decisionTimeSeconds) || 30;
      const roomName = String(body.roomName || 'Corporate Workshop').trim();

      const gameId = 'game_' + Math.random().toString(36).substring(2, 10);
      const userId = 'host_' + Math.random().toString(36).substring(2, 9);
      
      let code = generateGameCode();
      // Ensure unique code
      while (Array.from(games.values()).some((g) => g.game_code === code)) {
        code = generateGameCode();
      }

      const now = new Date().toISOString();

      const game: Game = {
        id: gameId,
        game_code: code,
        host_user_id: userId,
        status: 'lobby',
        current_round: 0,
        total_rounds: Math.max(1, Math.min(50, totalRounds)),
        decision_time_seconds: Math.max(10, Math.min(300, decisionTimeSeconds)),
        room_name: roomName || 'Corporate Workshop',
        created_at: now,
        updated_at: now,
      };

      games.set(gameId, game);
      players.set(gameId, []);
      rounds.set(gameId, []);
      decisions.set(gameId, []);

      try {
        saveStoreToDisk();
      } catch (saveErr) {
        console.warn('[Game Server] Non-fatal disk save warning:', saveErr);
      }

      console.log(`[Game Server] Created new game: ${game.game_code} (ID: ${game.id})`);
      res.status(200).json({ game, userId });
    } catch (err: any) {
      console.error('[Game Server] Error creating game:', err);
      res.status(500).json({ error: err?.message || 'Failed to create game room on server' });
    }
  });

  // Join Game by Code
  app.post('/api/games/join', (req: Request, res: Response) => {
    try {
      const { gameCode, playerName, avatar = '🛡️', userId: reqUserId } = req.body || {};

      if (!gameCode || !playerName) {
        res.status(400).json({ error: 'Game Code and Player Name are required.' });
        return;
      }

      const targetGame = findGameByCode(gameCode);

      if (!targetGame) {
        res.status(404).json({
          error: `Game code "${String(gameCode).toUpperCase()}" not found. Please verify the code on the host screen or scan the host QR code.`,
        });
        return;
      }

      if (targetGame.status === 'completed') {
        res.status(400).json({ error: 'This training session has already concluded.' });
        return;
      }

      const currentPlayers = players.get(targetGame.id) || [];
      const userId = reqUserId || 'user_' + Math.random().toString(36).substring(2, 9);
      let trimmedName = String(playerName).trim();

      // Check name conflict with other user - disambiguate if needed
      let existingSelf = currentPlayers.find((p) => p.user_id === userId);
      const otherUserWithSameName = currentPlayers.find(
        (p) => p.player_name.toLowerCase() === trimmedName.toLowerCase() && p.user_id !== userId
      );

      if (otherUserWithSameName && !existingSelf) {
        let suffix = 2;
        while (currentPlayers.some((p) => p.player_name.toLowerCase() === `${trimmedName} (${suffix})`.toLowerCase())) {
          suffix++;
        }
        trimmedName = `${trimmedName} (${suffix})`;
      }

      let playerObj: Player;

      if (existingSelf) {
        existingSelf.player_name = trimmedName;
        existingSelf.avatar = avatar || existingSelf.avatar || '🛡️';
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

      saveStoreToDisk();
      broadcastGameUpdate(targetGame.id);

      console.log(`[Game Server] Player "${trimmedName}" joined game ${targetGame.game_code}`);
      res.status(200).json({ game: targetGame, player: playerObj, userId });
    } catch (err: any) {
      console.error('[Game Server] Error joining game:', err);
      res.status(500).json({ error: err?.message || 'Failed to join game room' });
    }
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

    const allDList = decisions.get(gameId) || [];

    res.json({
      game,
      players: [...pList].sort((a, b) => b.score - a.score),
      currentRound,
      decisions: dList,
      rounds: rList,
      allDecisions: allDList,
    });
  });

  // Randomize / Set Pairs
  app.post('/api/games/:gameId/randomize-pairs', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundNumber, customPairs } = req.body || {};
    const game = games.get(gameId);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const pList = players.get(gameId) || [];
    const rNum = Number(roundNumber) || (game.current_round || 1);
    
    let pairings: PlayerPairing[] = [];
    if (customPairs && Array.isArray(customPairs) && customPairs.length > 0) {
      pairings = customPairs;
    } else {
      pairings = generatePairings(pList, rNum);
    }

    game.current_pairings = pairings;
    game.updated_at = new Date().toISOString();

    const rList = rounds.get(gameId) || [];
    const currentRound = rList.find((r) => r.round_number === rNum);
    if (currentRound) {
      currentRound.pairings = pairings;
    }

    saveStoreToDisk();
    broadcastGameUpdate(gameId);
    console.log(`[Game Server] Generated ${pairings.length} random pairs for game ${game.game_code}`);
    res.json({ success: true, pairings });
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

    // Ensure 2-player random pairings for this round
    let rPairings = game.current_pairings;
    // Generate fresh pairings per round if not already generated or if round changes
    if (!rPairings || rPairings.length === 0 || rPairings[0]?.round_number !== rNum) {
      rPairings = generatePairings(pList, rNum);
      game.current_pairings = rPairings;
    }

    const rList = rounds.get(gameId) || [];
    let round = rList.find((r) => r.round_number === rNum);
    if (!round) {
      round = {
        id: 'round_' + Math.random().toString(36).substring(2, 10),
        game_id: gameId,
        round_number: rNum,
        status: 'active',
        pairings: rPairings,
        started_at: now,
      };
      rList.push(round);
    } else {
      round.status = 'active';
      round.pairings = rPairings;
      round.started_at = now;
      round.revealed_at = undefined;
      round.ended_at = undefined;
    }
    rounds.set(gameId, rList);

    saveStoreToDisk();
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

    saveStoreToDisk();
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

    const activePairings = round.pairings || game.current_pairings || generatePairings(pList, round.round_number);
    const scoredPlayerIds = new Set<string>();

    // 1v1 Pairwise Decision Matrix Scoring
    activePairings.forEach((pair) => {
      const dec1 = dList.find((d) => d.round_id === roundId && d.player_id === pair.player1_id);
      const dec2 = dList.find((d) => d.round_id === roundId && d.player_id === pair.player2_id);

      const d1Val: DecisionType = dec1?.decision || 'no_decision';
      const d2Val: DecisionType = dec2?.decision || 'no_decision';

      let pts1 = 0;
      let pts2 = 0;

      if (d1Val === 'no_decision' && d2Val === 'no_decision') {
        pts1 = 0;
        pts2 = 0;
      } else if (d1Val === 'no_decision') {
        pts1 = 0;
        pts2 = d2Val === 'cooperate' ? 3 : 5;
      } else if (d2Val === 'no_decision') {
        pts1 = d1Val === 'cooperate' ? 3 : 5;
        pts2 = 0;
      } else if (d1Val === 'cooperate' && d2Val === 'cooperate') {
        pts1 = 3;
        pts2 = 3;
      } else if (d1Val === 'betray' && d2Val === 'cooperate') {
        pts1 = 5;
        pts2 = 0;
      } else if (d1Val === 'cooperate' && d2Val === 'betray') {
        pts1 = 0;
        pts2 = 5;
      } else if (d1Val === 'betray' && d2Val === 'betray') {
        pts1 = 1;
        pts2 = 1;
      }

      if (dec1) {
        dec1.points = pts1;
        scoredPlayerIds.add(pair.player1_id);
      }
      if (dec2) {
        dec2.points = pts2;
        scoredPlayerIds.add(pair.player2_id);
      }

      if (round.status !== 'revealed' && round.status !== 'completed') {
        const p1 = pList.find((p) => p.id === pair.player1_id);
        const p2 = pList.find((p) => p.id === pair.player2_id);
        if (p1) {
          p1.score += pts1;
          p1.status = 'ready';
        }
        if (p2) {
          p2.score += pts2;
          p2.status = 'ready';
        }
      }
    });

    // Fallback for any unpaired players
    dList
      .filter((d) => d.round_id === roundId)
      .forEach((dec) => {
        if (!scoredPlayerIds.has(dec.player_id)) {
          const pts = dec.decision === 'cooperate' ? 3 : dec.decision === 'betray' ? 5 : 0;
          dec.points = pts;
          if (round.status !== 'revealed' && round.status !== 'completed') {
            const player = pList.find((p) => p.id === dec.player_id);
            if (player) {
              player.score += pts;
              player.status = 'ready';
            }
          }
        }
      });

    round.status = 'revealed';
    round.pairings = activePairings;
    round.revealed_at = now;
    round.ended_at = now;
    game.status = 'results';
    game.current_pairings = activePairings;
    game.updated_at = now;

    decisions.set(gameId, dList);
    saveStoreToDisk();
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

    saveStoreToDisk();
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

    saveStoreToDisk();
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

    saveStoreToDisk();
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
    saveStoreToDisk();
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
