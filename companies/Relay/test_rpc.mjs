import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: { user } } = await supabase.auth.getUser(); // this won't work without token
  // Let's just query the RPC without auth or by logging in?
  // We can just query `email_accounts` directly with service role key if we had it, or just use the backend's server/index.mjs env.
}
test();
