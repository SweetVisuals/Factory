import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData?.session) { console.log('Auth failed'); return; }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const { count: sentCount } = await client
    .from('campaign_progress')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent');

  const { count: failedCount } = await client
    .from('campaign_progress')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  console.log(`Sent Emails: ${sentCount}`);
  console.log(`Failed Emails: ${failedCount}`);
}
main();
