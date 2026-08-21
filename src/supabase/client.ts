import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'trust_betray_supabase_url';
const STORAGE_KEY_KEY = 'trust_betray_supabase_key';

export function getSupabaseCredentials() {
  const envUrl = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_URL : undefined;
  const envKey = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY : undefined;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : null;

  const url = (localUrl && localUrl.trim() !== '') ? localUrl.trim() : (envUrl && envUrl.trim() !== '' ? envUrl.trim() : '');
  const key = (localKey && localKey.trim() !== '') ? localKey.trim() : (envKey && envKey.trim() !== '' ? envKey.trim() : '');

  const isConfigured = Boolean(
    url &&
    key &&
    url.startsWith('http') &&
    !url.includes('your-project.supabase.co') &&
    !key.includes('your-anon-key')
  );

  return { url, key, isConfigured };
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY_KEY);
    
    // Trigger client re-instantiation
    clientInstance = null;
  }
}

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : undefined,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
      return null;
    }
  }

  return clientInstance;
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return { success: false, message: 'URL must start with https:// or http://' };
    }
    const testClient = createClient(url, key, {
      global: {
        fetch: typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : undefined,
      },
    });
    const { error } = await testClient.from('games').select('id').limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        return { 
          success: false, 
          message: 'Connected to Supabase, but tables are missing! Please run the schema SQL in the SQL Editor.' 
        };
      }
      return { success: false, message: `Database check: ${error.message}` };
    }

    return { success: true, message: 'Successfully connected to Supabase & Verified tables!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection failed' };
  }
}
