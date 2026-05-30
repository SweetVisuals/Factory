import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    return;
  }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  try {
    const { data: cronJobs, error } = await client.rpc('execute_sql', {
      query: 'SELECT jobid, schedule, command, nodename, nodeport, database, username, active FROM cron.job'
    });
    if (error) {
      console.log('Error querying cron.job via RPC:', error.message);
    } else {
      console.log('=== cron.job ===');
      console.log(cronJobs);
    }
  } catch (err) {
    console.log('Catch: cron.job query failed:', err.message);
  }
}

main().catch(console.error);
