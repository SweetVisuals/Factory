import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

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

  const { count: totalSent } = await client.from('campaign_progress').select('*', { count: 'exact', head: true }).eq('status', 'sent');
  console.log('Total sent progress entries in DB:', totalSent);

  const { data: campaigns } = await client.from('campaigns').select('id, name, business_id');
  console.log('Campaigns count:', campaigns?.length);
}

main().catch(console.error);
