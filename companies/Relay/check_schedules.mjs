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

  const { data: schedules, error } = await client
    .from('scheduled_emails')
    .select(`
        id, campaign_id, scheduled_for, start_date, end_date, campaigns!inner (name, current_step)
    `)
    .eq('status', 'scheduled')
    .eq('campaigns.status', 'in_progress');

  console.log('Active Schedules Count:', schedules?.length);
  schedules?.forEach(s => {
      console.log(`Schedule: ${s.id} | Campaign: ${s.campaigns.name} | Step: ${s.campaigns.current_step} | Scheduled For: ${s.scheduled_for}`);
  });
}
main();
