import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_OPENCLAW_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_OPENCLAW_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Openclaw HQ environment variables');
}

export const openclawSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'openclaw-hq-auth-token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
