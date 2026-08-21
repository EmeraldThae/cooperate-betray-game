import React, { useState, useEffect } from 'react';
import { X, Database, Check, Copy, CheckCircle2, AlertCircle, RefreshCw, Terminal, ExternalLink, Shield } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, testSupabaseConnection } from '../supabase/client';
import { getActiveBackendMode, setActiveBackendMode } from '../supabase/serviceAdapter';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'credentials'>('status');
  const [mode, setMode] = useState<'supabase' | 'demo'>('demo');

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url || '');
      setKey(creds.key || '');
      setMode(getActiveBackendMode());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    saveSupabaseCredentials(url, key);
    setIsTesting(true);
    const res = await testSupabaseConnection(url, key);
    setIsTesting(false);
    setTestResult(res);
    if (res.success) {
      setActiveBackendMode('supabase');
      setMode('supabase');
    }
  };

  const handleToggleMode = (newMode: 'supabase' | 'demo') => {
    setActiveBackendMode(newMode);
    setMode(newMode);
  };

  const handleCopySql = () => {
    const sqlContent = `-- COOPERATE & BETRAY PRODUCTION SUPABASE SQL SETUP
-- Run this in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_code VARCHAR(16) NOT NULL UNIQUE,
  host_user_id TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'lobby',
  current_round INT NOT NULL DEFAULT 0,
  total_rounds INT NOT NULL DEFAULT 5,
  decision_time_seconds INT NOT NULL DEFAULT 30,
  room_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  player_name VARCHAR(64) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'waiting',
  avatar VARCHAR(32) DEFAULT 'neutral',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_name_per_game UNIQUE (game_id, player_name)
);

CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  CONSTRAINT unique_game_round UNIQUE (game_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  decision VARCHAR(32) NOT NULL DEFAULT 'no_decision',
  points INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_player_round_decision UNIQUE (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_public_select" ON public.games FOR SELECT USING (true);
CREATE POLICY "games_insert" ON public.games FOR INSERT WITH CHECK (true);
CREATE POLICY "games_update" ON public.games FOR UPDATE USING (true);

CREATE POLICY "players_public_select" ON public.players FOR SELECT USING (true);
CREATE POLICY "players_insert" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_update" ON public.players FOR UPDATE USING (true);

CREATE POLICY "rounds_select" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "rounds_insert" ON public.rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "rounds_update" ON public.rounds FOR UPDATE USING (true);

-- Decisions Privacy Policy
CREATE POLICY "decisions_privacy" ON public.decisions FOR SELECT
USING (
  player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()::text)
  OR round_id IN (SELECT id FROM public.rounds WHERE status IN ('revealed', 'completed'))
);
CREATE POLICY "decisions_insert" ON public.decisions FOR INSERT WITH CHECK (true);
CREATE POLICY "decisions_update" ON public.decisions FOR UPDATE USING (true);
CREATE POLICY "events_all" ON public.game_events FOR ALL USING (true);

-- Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.games, public.players, public.rounds, public.decisions, public.game_events;
`;

    navigator.clipboard.writeText(sqlContent);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        id="supabase-setup-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Supabase & Backend Architecture
              </h2>
              <p className="text-xs text-slate-400">PostgreSQL Database, Realtime WebSockets & Row-Level Security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            id="btn-close-setup-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-4 text-sm font-medium">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'status'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" /> System Status & Mode
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'sql'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" /> SQL Schema & Setup
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'credentials'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" /> API Credentials
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Current Mode Card */}
              <div className="p-5 rounded-xl border bg-slate-800/40 border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Active Backend Engine:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleMode('demo')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        mode === 'demo'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      ⚡ Demo / Sandbox Engine
                    </button>
                    <button
                      onClick={() => handleToggleMode('supabase')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        mode === 'supabase'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      🟢 Production Supabase
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-400 leading-relaxed">
                  {mode === 'supabase' ? (
                    <div className="flex items-start gap-2 text-emerald-300/90 bg-emerald-950/30 p-3 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                      <span>
                        Connected to Supabase PostgreSQL with real-time WebSockets and Row Level Security active.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-amber-300/90 bg-amber-950/30 p-3 rounded-lg border border-amber-500/20">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
                      <span>
                        Running in Zero-Configuration Sandbox Mode. Real-time multi-tab gameplay, instant simulated bot players, and local synchronization are enabled immediately!
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Architecture highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs">
                  <div className="font-semibold text-slate-200 mb-1">Row Level Security</div>
                  <p className="text-slate-400">Enforces secret decisions at the database level until revealed by Host.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs">
                  <div className="font-semibold text-slate-200 mb-1">Supabase Realtime</div>
                  <p className="text-slate-400">Instant WebSocket state sync across mobile players and desktop host.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs">
                  <div className="font-semibold text-slate-200 mb-1">Authoritative RPC</div>
                  <p className="text-slate-400">PostgreSQL calculates payoffs and prevents double scoring.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Execute this SQL in your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-1">Supabase SQL Editor <ExternalLink className="w-3 h-3" /></a> to create all tables, policies, and RPC functions:
                </p>
                <button
                  onClick={handleCopySql}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  id="btn-copy-sql"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-72">
                <pre>{`-- 1. Tables: games, players, rounds, decisions, game_events
-- 2. RLS Policies: Secret decision privacy before reveal
-- 3. Functions: create_game_with_code, reveal_round_scores_secure
-- 4. Publication: ALTER PUBLICATION supabase_realtime ADD TABLE ...`}</pre>
                <p className="mt-2 text-slate-400">// Click 'Copy SQL Script' above to grab the full 250-line production schema</p>
              </div>
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your Supabase Project URL and Anon Public Key below (or define them in <code className="text-slate-300">.env</code> as <code className="text-slate-300">VITE_SUPABASE_URL</code> and <code className="text-slate-300">VITE_SUPABASE_ANON_KEY</code>):
              </p>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Supabase Project URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Supabase Anon Public Key</label>
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-sm font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleSave}
                    disabled={isTesting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 transition"
                    id="btn-test-save-creds"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save & Test Connection
                  </button>

                  {testResult && (
                    <span className={`text-xs font-medium ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {testResult.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
