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

  // Check campaign_leads
  const { data: cl, error: cle } = await client.from('campaign_leads').select('*').limit(5);
  console.log('campaign_leads exists:', !cle, 'error:', cle?.message);
  if (cl) console.log('Sample:', JSON.stringify(cl[0]));

  // Check if the table actually exists by trying to describe columns
  // Try a raw query approach
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/campaign_leads?limit=1`, {
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authData.session.access_token}`
    }
  });
  const data = await response.json();
  console.log('campaign_leads via REST:', response.status, Array.isArray(data) ? `Accessible (${data.length} rows)` : JSON.stringify(data));
  
  // Get all leads
  const { data: leads } = await client.from('leads').select('id, company, location');
  console.log(`\nLeads: ${leads?.length || 0}`);
  
  // Let's check which tables exist
  const tablesToCheck = ['campaign_leads', 'lead_campaigns', 'campaign_leads_old'];
  for (const t of tablesToCheck) {
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${t}?limit=1`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Accept': 'application/json'
      }
    });
    console.log(`${t}: HTTP ${resp.status} ${resp.statusText}`);
  }
}

main().catch(console.error);
