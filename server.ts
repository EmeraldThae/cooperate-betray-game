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

function cleanCodeString(input: string): string {
  if (!input) return '';
  let cleaned = String(input).trim();
  // Remove zero-width spaces, non-breaking spaces, and unicode invisible characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0\u2013\u2014]/g, '-');
  // If user pasted a full URL or query string
  if (cleaned.includes('code=') || cleaned.includes('join=') || cleaned.includes('room=')) {
    const match = cleaned.match(/[?&](?:code|join|room)=([^&#\s]+)/i);
    if (match && match[1]) {
      cleaned = decodeURIComponent(match[1]);
    }
  }
  // Strip path segments if pasted like http://.../join/TB-XYZ
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    cleaned = parts[parts.length - 1] || cleaned;
  }
  // Strip trailing slashes, quotes, or hashes
  cleaned = cleaned.replace(/^[#'"]+|[/'"]+$/g, '').trim();
  return cleaned;
}

function extractCodeSuffix(input: string): string {
  const cleaned = cleanCodeString(input);
  let alpha = cleaned.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (alpha.startsWith('GAME') && alpha.length > 4) {
    alpha = alpha.substring(4);
  }
  if (alpha.startsWith('TB') && alpha.length > 2) {
    alpha = alpha.substring(2);
  }
  return alpha;
}

function normalizeGameCode(code: string): string {
  const suffix = extractCodeSuffix(code);
  return suffix ? `TB-${suffix}` : 'TB-ROOM';
}

// Convert visually ambiguous characters to standardized canonical forms
function standardizeLookalikes(str: string): string {
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/0/g, 'O')
    .replace(/[1I]/g, 'L')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B')
    .replace(/2/g, 'Z');
}

function findGameByCode(inputCode: string): Game | undefined {
  if (!inputCode) return undefined;
  const rawInput = cleanCodeString(inputCode);
  if (!rawInput) return undefined;

  const targetSuffix = extractCodeSuffix(rawInput);
  const targetNorm = targetSuffix ? `TB-${targetSuffix}` : normalizeGameCode(rawInput);
  const targetStandard = standardizeLookalikes(targetSuffix);
  const canonicalId = 'game_' + targetSuffix.toLowerCase();
  const canonicalAltId = 'game_tb' + targetSuffix.toLowerCase();

  // Always refresh in-memory with any disk data
  try {
    const diskStore = ensureDataFile();
    for (const [id, g] of Object.entries(diskStore.games)) {
      if (!games.has(id)) {
        games.set(id, g);
        if (diskStore.players[id]) players.set(id, diskStore.players[id]);
        if (diskStore.rounds[id]) rounds.set(id, diskStore.rounds[id]);
        if (diskStore.decisions[id]) decisions.set(id, diskStore.decisions[id]);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  // 1. Direct Map Key / Canonical ID lookup
  if (games.has(rawInput)) return games.get(rawInput);
  if (games.has(rawInput.toLowerCase())) return games.get(rawInput.toLowerCase());
  if (targetSuffix && games.has(canonicalId)) return games.get(canonicalId);
  if (targetSuffix && games.has(canonicalAltId)) return games.get(canonicalAltId);

  // 2. Exact match in games values
  for (const g of games.values()) {
    const gSuffix = extractCodeSuffix(g.game_code || g.id);
    const gId = g.id.toLowerCase();
    const inputLower = rawInput.toLowerCase();

    if (
      gId === inputLower ||
      g.game_code.toUpperCase() === rawInput.toUpperCase() ||
      g.game_code.toUpperCase() === targetNorm.toUpperCase() ||
      (targetSuffix && gSuffix === targetSuffix)
    ) {
      return g;
    }
  }

  // 3. Lookalike character matching for active games (e.g. 0 vs O, 1 vs L, 5 vs S)
  if (targetSuffix.length >= 3) {
    for (const g of games.values()) {
      if (g.status === 'completed') continue;
      const gSuffix = extractCodeSuffix(g.game_code || g.id);
      const gStandard = standardizeLookalikes(gSuffix);
      if (gStandard === targetStandard) {
        return g;
      }
    }
  }

  // 4. Prefix / partial match if length >= 4
  if (targetSuffix.length >= 4) {
    for (const g of games.values()) {
      if (g.status === 'completed') continue;
      const gSuffix = extractCodeSuffix(g.game_code || g.id);
      if (gSuffix.startsWith(targetSuffix) || targetSuffix.startsWith(gSuffix)) {
        return g;
      }
    }
  }

  // 5. Dynamic Provisioning Fallback:
  // If the user provided a valid game code structure (e.g. TB-7BL8W or 7BL8W or TB-6TTTF),
  // dynamically instantiate the canonical room session so cross-device joining from any browser NEVER fails.
  if (targetSuffix.length >= 2) {
    const newId = canonicalId;
    const formattedCode = targetNorm;
    
    // Check if an existing game already has this ID
    const existingById = games.get(newId) || games.get(canonicalAltId);
    if (existingById) return existingById;

    const newGame: Game = {
      id: newId,
      game_code: formattedCode,
      host_user_id: 'host_' + targetSuffix.toLowerCase(),
      status: 'lobby',
      current_round: 0,
      total_rounds: 5,
      decision_time_seconds: 30,
      room_name: 'Workshop Room ' + formattedCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    games.set(newId, newGame);
    if (!players.has(newId)) players.set(newId, []);
    if (!rounds.has(newId)) rounds.set(newId, []);
    if (!decisions.has(newId)) decisions.set(newId, []);
    try {
      saveStoreToDisk();
    } catch {}
    console.log(`[Game Server] Instantiated room: ${newGame.game_code} (ID: ${newGame.id})`);
    return newGame;
  }

  return undefined;
}

function resolveGame(idOrCode: string): Game | undefined {
  if (!idOrCode) return undefined;
  if (games.has(idOrCode)) return games.get(idOrCode);
  return findGameByCode(idOrCode);
}

function getAllGameKeys(gameOrId: Game | string): string[] {
  const keys = new Set<string>();
  if (typeof gameOrId === 'string') {
    const raw = cleanCodeString(gameOrId);
    if (raw) {
      keys.add(raw);
      keys.add(raw.toLowerCase());
      const suffix = extractCodeSuffix(raw);
      if (suffix) {
        keys.add('game_' + suffix.toLowerCase());
        keys.add('game_tb' + suffix.toLowerCase());
        keys.add(`TB-${suffix.toUpperCase()}`);
        keys.add(suffix.toUpperCase());
      }
    }
    const resolved = resolveGame(gameOrId);
    if (resolved) {
      keys.add(resolved.id);
      keys.add(resolved.id.toLowerCase());
      keys.add(resolved.game_code);
      keys.add(resolved.game_code.toUpperCase());
      const s = extractCodeSuffix(resolved.game_code);
      if (s) {
        keys.add('game_' + s.toLowerCase());
        keys.add(`TB-${s.toUpperCase()}`);
        keys.add(s.toUpperCase());
      }
    }
  } else if (gameOrId) {
    keys.add(gameOrId.id);
    keys.add(gameOrId.id.toLowerCase());
    keys.add(gameOrId.game_code);
    keys.add(gameOrId.game_code.toUpperCase());
    const s = extractCodeSuffix(gameOrId.game_code || gameOrId.id);
    if (s) {
      keys.add('game_' + s.toLowerCase());
      keys.add(`TB-${s.toUpperCase()}`);
      keys.add(s.toUpperCase());
    }
  }
  return Array.from(keys);
}

function getPlayersForGame(gameIdOrCode: string): Player[] {
  const resolved = resolveGame(gameIdOrCode);
  const keys = getAllGameKeys(resolved || gameIdOrCode);
  for (const k of keys) {
    const list = players.get(k);
    if (list && list.length > 0) return list;
  }
  for (const k of keys) {
    if (players.has(k)) return players.get(k)!;
  }
  return [];
}

function setPlayersForGame(gameIdOrCode: string, pList: Player[]) {
  const resolved = resolveGame(gameIdOrCode);
  const keys = getAllGameKeys(resolved || gameIdOrCode);
  for (const k of keys) {
    players.set(k, pList);
  }
}

function getRoundsForGame(gameIdOrCode: string): Round[] {
  const resolved = resolveGame(gameIdOrCode);
  const keys = getAllGameKeys(resolved || gameIdOrCode);
  for (const k of keys) {
    const list = rounds.get(k);
    if (list && list.length > 0) return list;
  }
  for (const k of keys) {
    if (rounds.has(k)) return rounds.get(k)!;
  }
  return [];
}

function setRoundsForGame(gameIdOrCode: string, rList: Round[]) {
  const resolved = resolveGame(gameIdOrCode);
  const keys = getAllGameKeys(resolved || gameIdOrCode);
  for (const k of keys) {
    rounds.set(k, rList);
  }
}

function getDecisionsForGame(gameIdOrCode: string): Decision[] {
  const resolved = resolveGame(gameIdOrCode);
  const keys = getAllGameKeys(resolved || gameIdOrCode);
  for (const k of keys) {
    const list = decisions.get(k);
    if (list && list.length > 0) return list;
  }
  for (const k of keys) {
    if (decisions.has(k)) return decisions.get(k)!;
  }
  return [];
}

function setDecisionsForGame(gameIdOrCode: string, dList: Decision[]) {
  const resolved = resolveGame(gameIdOrCode);
  const keys = getAllGameKeys(resolved || gameIdOrCode);
  for (const k of keys) {
    decisions.set(k, dList);
  }
}

function broadcastGameUpdate(gameId: string) {
  const resolved = resolveGame(gameId);
  const targetId = resolved ? resolved.id : gameId;

  const game = resolved || games.get(targetId);
  const pList = getPlayersForGame(targetId);
  const rList = getRoundsForGame(targetId);
  const currentRound = game ? rList.find((r) => r.round_number === game.current_round) || null : null;
  const dList = currentRound ? (getDecisionsForGame(targetId) || []).filter((d) => d.round_id === currentRound.id) : [];

  const allDList = getDecisionsForGame(targetId);

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

  const allKeys = getAllGameKeys(game || targetId);
  const clientSets = allKeys.map((k) => sseClients.get(k)).filter(Boolean) as Set<Response>[];
  const sent = new Set<Response>();

  clientSets.forEach((set) => {
    if (!set) return;
    set.forEach((res) => {
      if (sent.has(res)) return;
      sent.add(res);
      try {
        res.write(`data: ${payload}\n\n`);
      } catch {
        set.delete(res);
      }
    });
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
      totalRounds: targetGame.total_rounds,
      decisionTimeSeconds: targetGame.decision_time_seconds,
      playerCount: currentPlayers.length,
    });
  });

  // Get active games list for quick room discovery & joining
  app.get('/api/games/active', (req: Request, res: Response) => {
    try {
      // Reload in-memory if needed
      ensureDataFile();
      const activeList = Array.from(games.values())
        .filter((g) => g.status !== 'completed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8)
        .map((g) => ({
          id: g.id,
          game_code: g.game_code,
          room_name: g.room_name,
          status: g.status,
          total_rounds: g.total_rounds,
          player_count: (players.get(g.id) || []).length,
          created_at: g.created_at,
        }));
      res.json({ games: activeList });
    } catch (e: any) {
      res.json({ games: [] });
    }
  });

  // Create or Register Game
  app.post('/api/games', (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const totalRounds = Number(body.totalRounds) || 5;
      const decisionTimeSeconds = Number(body.decisionTimeSeconds) || 30;
      const roomName = String(body.roomName || 'Corporate Workshop').trim();
      const requestedCode = body.gameCode ? normalizeGameCode(String(body.gameCode)) : null;

      let code = requestedCode || generateGameCode();
      if (!requestedCode) {
        // Ensure unique code
        while (Array.from(games.values()).some((g) => g.game_code === code)) {
          code = generateGameCode();
        }
      }

      const suffix = extractCodeSuffix(code);
      const canonicalId = 'game_' + suffix.toLowerCase();
      const gameId = body.id || canonicalId;
      const userId = body.hostUserId || body.userId || 'host_' + suffix.toLowerCase();
      const now = new Date().toISOString();

      let existing = games.get(gameId) || games.get(canonicalId) || findGameByCode(code);
      let game: Game;

      if (existing) {
        existing.room_name = roomName;
        existing.total_rounds = Math.max(1, Math.min(50, totalRounds));
        existing.decision_time_seconds = Math.max(10, Math.min(300, decisionTimeSeconds));
        existing.status = body.status || 'lobby';
        existing.host_user_id = userId;
        existing.updated_at = now;
        game = existing;
        games.set(game.id, game);
      } else {
        game = {
          id: gameId,
          game_code: code,
          host_user_id: userId,
          status: body.status || 'lobby',
          current_round: Number(body.currentRound) || 0,
          total_rounds: Math.max(1, Math.min(50, totalRounds)),
          decision_time_seconds: Math.max(10, Math.min(300, decisionTimeSeconds)),
          room_name: roomName || 'Corporate Workshop',
          created_at: body.createdAt || now,
          updated_at: now,
        };
        games.set(gameId, game);
        if (!players.has(gameId)) players.set(gameId, body.players || []);
        if (!rounds.has(gameId)) rounds.set(gameId, body.rounds || []);
        if (!decisions.has(gameId)) decisions.set(gameId, body.decisions || []);
      }

      try {
        saveStoreToDisk();
      } catch (saveErr) {
        console.warn('[Game Server] Non-fatal disk save warning:', saveErr);
      }

      console.log(`[Game Server] Registered game: ${game.game_code} (ID: ${game.id})`);
      res.status(200).json({ game, userId });
    } catch (err: any) {
      console.error('[Game Server] Error creating game:', err);
      res.status(500).json({ error: err?.message || 'Failed to create game room on server' });
    }
  });

  // Client Sync / Keep-Alive Endpoint
  app.post('/api/games/sync', (req: Request, res: Response) => {
    try {
      const { game, players: pList, rounds: rList, decisions: dList } = req.body || {};
      if (!game || (!game.id && !game.game_code)) {
        res.status(400).json({ error: 'Valid game object is required for sync.' });
        return;
      }

      const normalizedCode = normalizeGameCode(game.game_code || game.id);
      const suffix = extractCodeSuffix(game.game_code || game.id);
      const canonicalId = 'game_' + suffix.toLowerCase();
      const targetId = game.id || canonicalId;

      let existing = games.get(targetId) || games.get(canonicalId) || findGameByCode(normalizedCode);

      if (!existing) {
        // Register new game from client
        const registeredGame: Game = {
          ...game,
          id: targetId,
          game_code: normalizedCode,
          updated_at: new Date().toISOString(),
        };
        games.set(targetId, registeredGame);
        if (pList && Array.isArray(pList)) players.set(targetId, pList);
        else if (!players.has(targetId)) players.set(targetId, []);
        if (rList && Array.isArray(rList)) rounds.set(targetId, rList);
        else if (!rounds.has(targetId)) rounds.set(targetId, []);
        if (dList && Array.isArray(dList)) decisions.set(targetId, dList);
        else if (!decisions.has(targetId)) decisions.set(targetId, []);

        saveStoreToDisk();
        console.log(`[Game Server] Synced new game from client: ${registeredGame.game_code} (ID: ${registeredGame.id})`);
        res.json({
          success: true,
          registered: true,
          game: registeredGame,
          players: players.get(targetId) || [],
          rounds: rounds.get(targetId) || [],
          decisions: decisions.get(targetId) || [],
        });
      } else {
        // Update existing game
        existing.status = game.status || existing.status;
        existing.current_round = game.current_round ?? existing.current_round;
        if (game.room_name) existing.room_name = game.room_name;
        if (game.total_rounds) existing.total_rounds = game.total_rounds;
        if (game.decision_time_seconds) existing.decision_time_seconds = game.decision_time_seconds;
        existing.updated_at = new Date().toISOString();

        // Merge players without deleting server-registered players
        const existingPlayers = players.get(existing.id) || [];
        if (pList && Array.isArray(pList) && pList.length > 0) {
          const pMap = new Map<string, Player>();
          existingPlayers.forEach((p) => pMap.set(p.id, p));
          pList.forEach((p) => {
            if (p && p.id) {
              if (pMap.has(p.id)) {
                pMap.set(p.id, { ...pMap.get(p.id)!, ...p });
              } else {
                pMap.set(p.id, p);
              }
            }
          });
          players.set(existing.id, Array.from(pMap.values()));
        }

        if (rList && Array.isArray(rList) && rList.length > 0) {
          const existingRounds = rounds.get(existing.id) || [];
          const rMap = new Map<string, Round>();
          existingRounds.forEach((r) => rMap.set(r.id, r));
          rList.forEach((r) => {
            if (r && r.id) rMap.set(r.id, r);
          });
          rounds.set(existing.id, Array.from(rMap.values()));
        }

        if (dList && Array.isArray(dList) && dList.length > 0) {
          const existingDecisions = decisions.get(existing.id) || [];
          const dMap = new Map<string, Decision>();
          existingDecisions.forEach((d) => dMap.set(d.id, d));
          dList.forEach((d) => {
            if (d && d.id) dMap.set(d.id, d);
          });
          decisions.set(existing.id, Array.from(dMap.values()));
        }

        saveStoreToDisk();
        res.json({
          success: true,
          registered: false,
          game: existing,
          players: players.get(existing.id) || [],
          rounds: rounds.get(existing.id) || [],
          decisions: decisions.get(existing.id) || [],
        });
      }
    } catch (err: any) {
      console.error('[Game Server] Sync error:', err);
      res.status(500).json({ error: 'Sync failed' });
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

      const currentPlayers = getPlayersForGame(targetGame.id);
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
      }

      setPlayersForGame(targetGame.id, currentPlayers);

      try {
        saveStoreToDisk();
      } catch (saveErr) {
        console.warn('[Game Server] Non-fatal disk save warning:', saveErr);
      }

      try {
        broadcastGameUpdate(targetGame.id);
      } catch (sseErr) {
        console.warn('[Game Server] Non-fatal broadcast warning:', sseErr);
      }

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
    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }

    const gId = game.id;
    const pList = getPlayersForGame(gId);
    const rList = getRoundsForGame(gId);
    const currentRound = rList.find((r) => r.round_number === game.current_round) || null;
    const dList = currentRound ? (getDecisionsForGame(gId) || []).filter((d) => d.round_id === currentRound.id) : [];

    const allDList = getDecisionsForGame(gId);

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
    const game = resolveGame(gameId);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const pList = getPlayersForGame(gId);
    const rNum = Number(roundNumber) || (game.current_round || 1);
    
    let pairings: PlayerPairing[] = [];
    if (customPairs && Array.isArray(customPairs) && customPairs.length > 0) {
      pairings = customPairs;
    } else {
      pairings = generatePairings(pList, rNum);
    }

    game.current_pairings = pairings;
    game.updated_at = new Date().toISOString();

    const rList = getRoundsForGame(gId);
    const currentRound = rList.find((r) => r.round_number === rNum);
    if (currentRound) {
      currentRound.pairings = pairings;
    }
    setRoundsForGame(gId, rList);

    saveStoreToDisk();
    broadcastGameUpdate(gId);
    console.log(`[Game Server] Generated ${pairings.length} random pairs for game ${game.game_code}`);
    res.json({ success: true, pairings });
  });

  // Start Round
  app.post('/api/games/:gameId/start-round', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundNumber } = req.body || {};
    const game = resolveGame(gameId);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const now = new Date().toISOString();
    const rNum = Number(roundNumber) || (game.current_round + 1);

    game.status = 'round_active';
    game.current_round = rNum;
    game.updated_at = now;

    // Reset players to playing
    const pList = getPlayersForGame(gId);
    pList.forEach((p) => {
      p.status = 'playing';
    });
    setPlayersForGame(gId, pList);

    // Ensure 2-player random pairings for this round
    let rPairings = game.current_pairings;
    if (!rPairings || rPairings.length === 0 || rPairings[0]?.round_number !== rNum) {
      rPairings = generatePairings(pList, rNum);
      game.current_pairings = rPairings;
    }

    const rList = getRoundsForGame(gId);
    let round = rList.find((r) => r.round_number === rNum);
    if (!round) {
      round = {
        id: 'round_' + Math.random().toString(36).substring(2, 10),
        game_id: gId,
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
    setRoundsForGame(gId, rList);

    saveStoreToDisk();
    broadcastGameUpdate(gId);
    res.json(round);
  });

  // Submit Decision
  app.post('/api/games/:gameId/decisions', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundId, playerId, decision } = req.body || {};

    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const dList = getDecisionsForGame(gId);
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
    setDecisionsForGame(gId, dList);

    // Mark player as submitted
    const pList = getPlayersForGame(gId);
    const player = pList.find((p) => p.id === playerId);
    if (player) {
      player.status = 'submitted';
      setPlayersForGame(gId, pList);
    }

    saveStoreToDisk();
    broadcastGameUpdate(gId);
    res.json(existing);
  });

  // Reveal Round Results
  app.post('/api/games/:gameId/reveal', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundId } = req.body || {};

    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const rList = getRoundsForGame(gId);
    const round = rList.find((r) => r.id === roundId);
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }

    const pList = getPlayersForGame(gId);
    const dList = getDecisionsForGame(gId);
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

    setPlayersForGame(gId, pList);
    setRoundsForGame(gId, rList);
    setDecisionsForGame(gId, dList);

    saveStoreToDisk();
    broadcastGameUpdate(gId);

    res.json({ success: true, roundId });
  });

  // Complete Game
  app.post('/api/games/:gameId/complete', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const now = new Date().toISOString();
    game.status = 'completed';
    game.updated_at = now;

    const pList = getPlayersForGame(gId);
    pList.forEach((p) => {
      p.status = 'completed';
    });
    setPlayersForGame(gId, pList);

    saveStoreToDisk();
    broadcastGameUpdate(gId);
    res.json({ success: true });
  });

  // Reset Game to Lobby
  app.post('/api/games/:gameId/reset', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const now = new Date().toISOString();
    game.status = 'lobby';
    game.current_round = 0;
    game.updated_at = now;

    setRoundsForGame(gId, []);
    setDecisionsForGame(gId, []);

    const pList = getPlayersForGame(gId);
    pList.forEach((p) => {
      p.score = 0;
      p.status = 'waiting';
    });
    setPlayersForGame(gId, pList);

    saveStoreToDisk();
    broadcastGameUpdate(gId);
    res.json({ success: true });
  });

  // Simulated Player (Bot)
  app.post('/api/games/:gameId/simulated-player', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { name, avatar = '🤖' } = req.body || {};
    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const pList = getPlayersForGame(gId);
    const botPlayer: Player = {
      id: 'bot_' + Math.random().toString(36).substring(2, 9),
      game_id: gId,
      user_id: 'bot_user_' + Math.random().toString(36).substring(2, 9),
      player_name: name || `Player ${pList.length + 1}`,
      score: 0,
      status: game.status === 'round_active' ? 'playing' : 'waiting',
      avatar,
      joined_at: new Date().toISOString(),
    };
    pList.push(botPlayer);
    setPlayersForGame(gId, pList);

    saveStoreToDisk();
    broadcastGameUpdate(gId);
    res.json(botPlayer);
  });

  // Auto-submit bots
  app.post('/api/games/:gameId/auto-bots', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { roundId } = req.body || {};
    const game = resolveGame(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gId = game.id;
    const pList = getPlayersForGame(gId);
    const dList = getDecisionsForGame(gId);
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

    setPlayersForGame(gId, pList);
    setDecisionsForGame(gId, dList);
    saveStoreToDisk();
    broadcastGameUpdate(gId);
    res.json({ success: true });
  });

  // Server-Sent Events (SSE) for Real-Time Cross-Device Sync
  app.get('/api/games/:gameId/stream', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = resolveGame(gameId);
    const gId = game ? game.id : gameId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const allKeys = getAllGameKeys(game || gId);
    allKeys.forEach((key) => {
      if (!sseClients.has(key)) {
        sseClients.set(key, new Set());
      }
      sseClients.get(key)!.add(res);
    });

    // Send initial snapshot immediately
    const pList = getPlayersForGame(gId);
    const rList = getRoundsForGame(gId);
    const currentRound = game ? rList.find((r) => r.round_number === game.current_round) || null : null;
    const dList = currentRound ? (getDecisionsForGame(gId) || []).filter((d) => d.round_id === currentRound.id) : [];

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
      allKeys.forEach((key) => {
        if (sseClients.has(key)) {
          sseClients.get(key)!.delete(res);
        }
      });
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
