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

  const { data: campaigns } = await client.from('campaigns').select('id, name, created_at, business_id').order('created_at', { ascending: true });
  
  for (const c of campaigns) {
    const { data: schedules } = await client.from('scheduled_emails').select('id, start_date, scheduled_for, status, sent_emails').eq('campaign_id', c.id);
    const { data: progress } = await client.from('campaign_progress').select('status').eq('campaign_id', c.id);
    const sent = progress ? progress.filter(p => p.status === 'sent').length : 0;
    const failed = progress ? progress.filter(p => p.status === 'failed').length : 0;
    
    console.log(`Campaign: ${c.name} (${c.business_id === '0269fe06-4607-4c58-9263-12a3930a1dc3' ? 'MrMedic' : 'Relay'})`);
    console.log(`  Created: ${c.created_at}`);
    console.log(`  Sent: ${sent}, Failed: ${failed}`);
    if (schedules) {
      schedules.forEach((s, idx) => {
        console.log(`  Step ${idx + 1}: start_date=${s.start_date}, scheduled_for=${s.scheduled_for}, status=${s.status}, sent_emails=${s.sent_emails}`);
      });
    }
    console.log('---');
  }
}
main();
