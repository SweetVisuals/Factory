import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be set in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'relay-factory-auth-token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 0
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'relay-factory'
    }
  }
});

// Disable realtime entirely - self-hosted Supabase doesn't have it configured
// All realtime channel subscriptions will silently no-op instead of spamming WebSocket errors
const originalChannel = supabase.channel.bind(supabase);
supabase.channel = (...args: Parameters<typeof supabase.channel>) => {
  const channel = originalChannel(...args);
  channel.subscribe = (callback?: any) => {
    // Return the channel without actually connecting to prevent WebSocket errors
    if (callback) callback('CLOSED', new Error('Realtime disabled'));
    return channel;
  };
  return channel;
};

export { supabase };
