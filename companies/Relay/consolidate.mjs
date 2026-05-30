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

  // Get all campaigns with lead counts
  const { data: campaigns } = await client.from('campaigns').select('*');
  
  for (const c of campaigns) {
    const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
    c.lead_count = count || 0;
  }
  
  // Sort by lead count desc
  campaigns.sort((a, b) => b.lead_count - a.lead_count);
  
  console.log('Current campaign state:');
  campaigns.forEach(c => console.log(`  ${c.status === 'Draft' ? 'DRAFT' : c.status.padEnd(8)} | ${String(c.lead_count).padStart(3)} leads | ${c.name}`));
  
  // Strategy: Keep the 5 most important campaigns with data
  // Keep: Legal Services - UK, Law Firm Cybersecurity Compliance, Cybersecurity Compliance, Roofing Contractors, E-commerce Stores
  // Consolidate duplicated cybersecurity/law firm campaigns
  
  const keepNames = [
    'Legal Services - UK',
    'Law Firm Cybersecurity Compliance', 
    'Cybersecurity Compliance',
    'Roofing Contractors - US',
    'E-commerce Stores'
  ];
  
  const deleteNames = [
    'London Law Firm Outreach',      // duplicate of Legal Services - UK
    'AI-Powered QA Automation',      // no leads, not a focus
    'Real Estate Agents',            // duplicate, no leads
    'Real Estate Agent Outreach',    // duplicate, no leads  
    'Law Firm Cybersecurity (Partners/IT)',   // duplicate
    'Law Firm Cybersecurity Compliance USA'   // duplicate
  ];
  
  // Move leads from duplicate campaigns to the primary ones
  const mergeMap = {
    'London Law Firm Outreach': 'Legal Services - UK',
    'Law Firm Cybersecurity Compliance USA': 'Law Firm Cybersecurity Compliance',
    'Law Firm Cybersecurity (Partners/IT)': 'Cybersecurity Compliance',
    'Real Estate Agent Outreach': 'Legal Services - UK',  // no real estate leads exist anyway
    'Real Estate Agents': 'Legal Services - UK',
    'AI-Powered QA Automation': 'Cybersecurity Compliance'
  };
  
  // Move leads
  for (const [fromName, toName] of Object.entries(mergeMap)) {
    const from = campaigns.find(c => c.name === fromName);
    const to = campaigns.find(c => c.name === toName);
    if (!from || !to) continue;
    
    const { data: leadsToMove } = await client.from('campaign_leads').select('lead_id').eq('campaign_id', from.id);
    if (leadsToMove && leadsToMove.length > 0) {
      let moved = 0;
      for (const { lead_id } of leadsToMove) {
        const { error } = await client.from('campaign_leads').upsert({
          campaign_id: to.id,
          lead_id
        }, { onConflict: 'campaign_id,lead_id' });
        if (!error) moved++;
      }
      console.log(`Moved ${moved}/${leadsToMove.length} leads from "${fromName}" to "${toName}"`);
    }
  }
  
  // Delete duplicate campaigns (actually mark as archived)
  for (const name of deleteNames) {
    const c = campaigns.find(c => c.name === name);
    if (!c) continue;
    
    // Delete campaign_leads for this campaign
    await client.from('campaign_leads').delete().eq('campaign_id', c.id);
    // Delete the campaign
    const { error } = await client.from('campaigns').delete().eq('id', c.id);
    console.log(`Deleted campaign: "${name}" ${error ? 'ERROR: ' + error.message : 'OK'}`);
  }
  
  // Update lead counts for kept campaigns
  console.log('\nFinal campaign state:');
  const { data: final } = await client.from('campaigns').select('*');
  for (const c of final) {
    const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
    await client.from('campaigns').update({ prospects: count || 0 }).eq('id', c.id);
    console.log(`  ${c.name}: ${count || 0} leads | ${c.status}`);
  }
}

main().catch(console.error);
