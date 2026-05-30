import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData) { console.log('Auth failed'); return; }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const { data: campaigns } = await client.from('campaigns').select('*');
  
  console.log('=== CAMPAIGN STATUS ===\n');
  
  let totalLeads = 0;
  let totalWithEmail = 0;
  
  for (const c of campaigns) {
    const { data: cl } = await client.from('campaign_leads').select('lead_id').eq('campaign_id', c.id);
    const leadIds = cl?.map(l => l.lead_id) || [];
    
    const { count: total } = await client.from('leads').select('*', { count: 'exact', head: true }).in('id', leadIds.length > 0 ? leadIds : ['no-ids']);
    const { count: withEmail } = await client.from('leads').select('*', { count: 'exact', head: true }).in('id', leadIds.length > 0 ? leadIds : ['no-ids']).neq('email', '');
    
    totalLeads += total || 0;
    totalWithEmail += withEmail || 0;
    
    console.log(`  ${c.name}`);
    console.log(`    ID: ${c.id}`);
    console.log(`    Status: ${c.status}`);
    console.log(`    Prospects: ${total || 0} (${withEmail || 0} with email)`);
    console.log('');
  }
  
  const { count: allLeads } = await client.from('leads').select('*', { count: 'exact', head: true });
  console.log(`Total leads in DB: ${allLeads}`);
  console.log(`Total assigned to campaigns: ${totalLeads}`);
}

main().catch(console.error);
