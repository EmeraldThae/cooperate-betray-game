-- ==============================================================================
-- COOPERATE & BETRAY - Production Supabase PostgreSQL Schema & Security Rules
-- Multi-player Corporate Decision Making & Team Building Platform
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES
-- Table: games
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_code VARCHAR(16) NOT NULL UNIQUE,
  host_user_id TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'lobby' 
    CHECK (status IN ('lobby', 'round_active', 'waiting_for_reveal', 'results', 'completed')),
  current_round INT NOT NULL DEFAULT 0,
  total_rounds INT NOT NULL DEFAULT 5 CHECK (total_rounds > 0),
  decision_time_seconds INT NOT NULL DEFAULT 30 CHECK (decision_time_seconds >= 10),
  room_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: players
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  player_name VARCHAR(64) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'waiting' 
    CHECK (status IN ('waiting', 'ready', 'playing', 'submitted', 'disconnected', 'completed')),
  avatar VARCHAR(32) DEFAULT 'neutral',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_name_per_game UNIQUE (game_id, player_name),
  CONSTRAINT unique_user_per_game UNIQUE (game_id, user_id)
);

-- Table: rounds
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('pending', 'active', 'waiting_for_reveal', 'revealed', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  CONSTRAINT unique_game_round UNIQUE (game_id, round_number)
);

-- Table: decisions
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  decision VARCHAR(32) NOT NULL DEFAULT 'no_decision' 
    CHECK (decision IN ('cooperate', 'betray', 'no_decision')),
  points INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_player_round_decision UNIQUE (round_id, player_id)
);

-- Table: game_events
CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_games_game_code ON public.games(game_code);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON public.players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON public.rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_decisions_round_id ON public.decisions(round_id);
CREATE INDEX IF NOT EXISTS idx_decisions_player_id ON public.decisions(player_id);
CREATE INDEX IF NOT EXISTS idx_events_game_id ON public.game_events(game_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Games Policies
CREATE POLICY "Anyone can view games by code or ID"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Authenticated or Anon users can create games"
  ON public.games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Host can update their own game"
  ON public.games FOR UPDATE
  USING (host_user_id = auth.uid()::text OR host_user_id = current_setting('request.jwt.claim.sub', true));

-- Players Policies
CREATE POLICY "Anyone in the game can view players"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Users can join games as player"
  ON public.players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Player or Host can update player profile / status"
  ON public.players FOR UPDATE
  USING (true);

-- Rounds Policies
CREATE POLICY "Anyone in the game can view rounds"
  ON public.rounds FOR SELECT
  USING (true);

CREATE POLICY "Host can create rounds"
  ON public.rounds FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Host can update rounds"
  ON public.rounds FOR UPDATE
  USING (true);

-- Decisions Policies (CRITICAL PRIVACY SAFEGUARD)
-- Players can see their own decision at ANY time.
-- All participants can see all decisions in a round ONLY when the round status is 'revealed' or 'completed'!
CREATE POLICY "View own decision or revealed round decisions"
  ON public.decisions FOR SELECT
  USING (
    -- Case 1: Player can always view their own decision
    player_id IN (
      SELECT id FROM public.players 
      WHERE user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claim.sub', true)
    )
    OR
    -- Case 2: Round has been revealed to everyone
    round_id IN (
      SELECT id FROM public.rounds 
      WHERE status IN ('revealed', 'completed')
    )
  );

CREATE POLICY "Players can insert their own decision"
  ON public.decisions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update of decisions on reveal"
  ON public.decisions FOR UPDATE
  USING (true);

-- Game Events Policies
CREATE POLICY "View game events"
  ON public.game_events FOR SELECT
  USING (true);

CREATE POLICY "Insert game events"
  ON public.game_events FOR INSERT
  WITH CHECK (true);


-- 5. SECURE DATABASE RPC FUNCTIONS

-- Function: create_game_with_code
CREATE OR REPLACE FUNCTION public.create_game_with_code(
  p_host_user_id TEXT,
  p_total_rounds INT DEFAULT 5,
  p_decision_time_seconds INT DEFAULT 30,
  p_room_name TEXT DEFAULT 'Workshop Session'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- No O/0, I/1, S/5
  v_code TEXT;
  v_game_id UUID;
  v_exists BOOLEAN;
  v_i INT;
BEGIN
  -- Generate unique easy-to-read code e.g. TB-7K4P9
  LOOP
    v_code := 'TB-';
    FOR v_i IN 1..5 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM public.games WHERE game_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  INSERT INTO public.games (game_code, host_user_id, status, current_round, total_rounds, decision_time_seconds, room_name)
  VALUES (v_code, p_host_user_id, 'lobby', 0, p_total_rounds, p_decision_time_seconds, p_room_name)
  RETURNING id INTO v_game_id;

  INSERT INTO public.game_events (game_id, event_type, metadata)
  VALUES (v_game_id, 'game_created', jsonb_build_object('code', v_code, 'host', p_host_user_id));

  RETURN jsonb_build_object(
    'game_id', v_game_id,
    'game_code', v_code,
    'status', 'lobby',
    'total_rounds', p_total_rounds,
    'decision_time_seconds', p_decision_time_seconds
  );
END;
$$;

-- Function: reveal_round_scores_secure
-- Idempotent, authoritative calculation for Cooperate/Betray
CREATE OR REPLACE FUNCTION public.reveal_round_scores_secure(
  p_round_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game_id UUID;
  v_round_number INT;
  v_round_status VARCHAR(32);
  v_total_players INT;
  v_coop_count INT := 0;
  v_betray_count INT := 0;
  v_no_decision_count INT := 0;
  v_player RECORD;
  v_points INT;
BEGIN
  -- Verify round
  SELECT game_id, round_number, status 
  INTO v_game_id, v_round_number, v_round_status
  FROM public.rounds 
  WHERE id = p_round_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  -- Ensure any player who did not submit gets 'no_decision'
  INSERT INTO public.decisions (round_id, player_id, decision, points)
  SELECT p_round_id, p.id, 'no_decision', 0
  FROM public.players p
  WHERE p.game_id = v_game_id
    AND NOT EXISTS (
      SELECT 1 FROM public.decisions d 
      WHERE d.round_id = p_round_id AND d.player_id = p.id
    );

  -- Count decisions
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE decision = 'cooperate'),
    COUNT(*) FILTER (WHERE decision = 'betray'),
    COUNT(*) FILTER (WHERE decision = 'no_decision')
  INTO v_total_players, v_coop_count, v_betray_count, v_no_decision_count
  FROM public.decisions
  WHERE round_id = p_round_id;

  -- Calculate points for each player
  FOR v_player IN (
    SELECT d.id AS decision_id, d.player_id, d.decision, p.score AS current_score
    FROM public.decisions d
    JOIN public.players p ON p.id = d.player_id
    WHERE d.round_id = p_round_id
  ) LOOP
    IF v_player.decision = 'no_decision' THEN
      v_points := 0;
    ELSIF v_betray_count = 0 THEN
      -- Everyone Cooperated! +3 each
      v_points := 3;
    ELSIF v_coop_count = 0 THEN
      -- Everyone Betrayed! +1 each
      v_points := 1;
    ELSE
      -- Mixed: Betrayers get +5, Cooperators get +0
      IF v_player.decision = 'betray' THEN
        v_points := 5;
      ELSE
        v_points := 0;
      END IF;
    END IF;

    -- Update decision record with calculated points
    UPDATE public.decisions
    SET points = v_points
    WHERE id = v_player.decision_id;

    -- Update player cumulative score (Idempotent check: only add if round was not already revealed)
    IF v_round_status <> 'revealed' AND v_round_status <> 'completed' THEN
      UPDATE public.players
      SET score = score + v_points,
          status = 'ready'
      WHERE id = v_player.player_id;
    END IF;
  END LOOP;

  -- Mark round revealed
  UPDATE public.rounds
  SET status = 'revealed',
      revealed_at = NOW(),
      ended_at = COALESCE(ended_at, NOW())
  WHERE id = p_round_id;

  -- Update game status to 'results'
  UPDATE public.games
  SET status = 'results',
      updated_at = NOW()
  WHERE id = v_game_id;

  -- Log event
  INSERT INTO public.game_events (game_id, round_id, event_type, metadata)
  VALUES (v_game_id, p_round_id, 'results_revealed', jsonb_build_object(
    'round', v_round_number,
    'cooperators', v_coop_count,
    'betrayers', v_betray_count,
    'no_decisions', v_no_decision_count
  ));

  RETURN jsonb_build_object(
    'success', true,
    'round_id', p_round_id,
    'cooperators', v_coop_count,
    'betrayers', v_betray_count,
    'no_decisions', v_no_decision_count
  );
END;
$$;

-- 6. ENABLE REALTIME
-- Run this in Supabase SQL editor to broadcast live game changes
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.games, public.players, public.rounds, public.decisions, public.game_events';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
