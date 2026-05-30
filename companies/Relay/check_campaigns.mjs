import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../backend/.env' });

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

  const { data: campaigns, error } = await client.from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching campaigns:', error.message);
    return;
  }

  console.log(`--- CAMPAIGNS (${campaigns.length}) ---`);
  if (campaigns.length > 0) {
    console.log("Columns:", Object.keys(campaigns[0]));
  }
  campaigns.forEach(c => {
    console.log(`ID: ${c.id}`);
    console.log(`Name: ${c.name}`);
    console.log(`Niche: ${c.niche}`);
    console.log(`Prospects: ${c.prospects}`);
    console.log(`Business ID: ${c.business_id}`);
    console.log(`Status: ${c.status}`);
    console.log('---------------------------------------------');
  });
}

main().catch(console.error);
