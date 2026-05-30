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

  const token = authData.session.access_token;
  const baseUrl = 'http://localhost:3001';

  // 1. Get campaigns with few leads
  const { data: campaigns } = await client.from('campaigns').select('*');
  
  for (const c of campaigns) {
    const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
    
    // If a campaign has fewer than 20 leads, scrape more
    if (count < 20) {
      const niche = c.name.toLowerCase().includes('roofing') ? 'roofing contractors' :
                    c.name.toLowerCase().includes('ecom') ? 'ecommerce stores' :
                    c.name.toLowerCase().includes('legal') ? 'law firm' :
                    c.name.toLowerCase().includes('cyber') ? 'cybersecurity compliance' : 'business';
      
      console.log(`Scraping "${c.name}" — current leads: ${count}, target: 20+`);
      
      const resp = await fetch(`${baseUrl}/api/scrape-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business: niche,
          location: c.name.toLowerCase().includes('uk') ? 'United Kingdom' : 'United States',
          limit: 20,
          campaignId: c.id,
          keywords: niche
        })
      });
      const result = await resp.json();
      console.log(`  Response: ${resp.status} — ${result.success ? 'Started' : result.error || 'Failed'}`);
    } else {
      console.log(`Skipping "${c.name}" — ${count} leads (sufficient)`);
    }
  }
  
  // 2. Update campaign prospects counts
  for (const c of campaigns) {
    const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
    await client.from('campaigns').update({ prospects: count || 0 }).eq('id', c.id);
  }
  
  console.log('\nDone. Campaign prospect counts updated.');
}

main().catch(console.error);
