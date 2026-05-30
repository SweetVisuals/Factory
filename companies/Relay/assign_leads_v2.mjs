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

  // Get campaigns
  const { data: campaigns } = await client.from('campaigns').select('*');
  const campMap = {};
  campaigns.forEach(c => { campMap[c.name] = c.id; });
  console.log('Campaign IDs:');
  Object.entries(campMap).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Get all leads
  const { data: leads } = await client.from('leads').select('id, company, location');

  // Map campaigns
  const legalUK = campMap['Legal Services - UK'];
  const legalUSA = campMap['Law Firm Cybersecurity Compliance'];
  const legalUKExisting = campMap['London Law Firm Outreach'];
  const cyberUSA = campMap['Cybersecurity Compliance'];
  
  console.log(`\nAssigning ${leads.length} leads...`);

  let ukCount = 0, usCount = 0, cyberCount = 0, skipped = 0;

  for (const lead of leads) {
    const c = (lead.company || '').toLowerCase();
    const l = (lead.location || '').toLowerCase();
    const searchText = c + ' ' + l;
    
    // Cyber security keywords
    const cyberKeywords = ['cyber', 'security', 'compliance', 'infosec', 'it security', 'cybersecurity', 'msp', 'managed service', 'data protection'];
    const isCyber = cyberKeywords.some(k => searchText.includes(k));
    
    // UK location
    const isUK = l.includes('uk') || l.includes('london') || l.includes('england') || l.includes('united kingdom') || l.includes('birmingham') || l.includes('manchester') || l.includes('liverpool');
    
    let targetCampaignId;
    if (isCyber) {
      targetCampaignId = cyberUSA;
      cyberCount++;
    } else if (isUK) {
      targetCampaignId = legalUK;
      ukCount++;
    } else {
      targetCampaignId = legalUSA;
      usCount++;
    }
    
    // Upsert into campaign_leads
    const { error: ue } = await client.from('campaign_leads').upsert({
      campaign_id: targetCampaignId,
      lead_id: lead.id
    }, { onConflict: 'campaign_id,lead_id' });
    
    if (ue) {
      skipped++;
      if (skipped <= 3) console.log(`Error: ${lead.company}: ${ue.message}`);
    }
  }

  console.log(`\nResults: UK=${ukCount} US=${usCount} Cyber=${cyberCount} Errors=${skipped}`);
  
  // Update prospect counts on campaigns
  for (const [name, id] of Object.entries(campMap)) {
    const { count } = await client.from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);
    
    if (count > 0) {
      await client.from('campaigns').update({ prospects: count }).eq('id', id);
      console.log(`  ${name}: ${count} prospects`);
    }
  }
}

main().catch(console.error);
