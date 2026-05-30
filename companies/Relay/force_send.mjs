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

  const now = new Date().toISOString();
  
  console.log(`Updating scheduled_for to ${now} for active schedules...`);
  
  const { data: schedules } = await client
    .from('scheduled_emails')
    .select('id, campaign_id')
    .eq('status', 'scheduled');
    
  if (schedules && schedules.length > 0) {
      for (const s of schedules) {
          await client.from('scheduled_emails')
            .update({ scheduled_for: now, start_date: now })
            .eq('id', s.id);
      }
      console.log(`Updated ${schedules.length} schedules.`);
  }

  console.log('Invoking process-campaign function...');
  const { data: result, error: invokeErr } = await client.functions.invoke('process-campaign');
  
  if (invokeErr) {
      console.error('Invoke Error:', invokeErr);
  } else {
      console.log('Invoke Result:', result);
  }
}
main();
