import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: campaigns } = await client.from('campaigns').select('id, name, niche').in('status', ['active', 'in_progress']);
  
  let allLeads = [];
  let start = 0;
  const limit = 1000;
  while (true) {
    const { data: chunk } = await client.from('leads').select('id, company, industry, summary').range(start, start + limit - 1);
    if (!chunk || chunk.length === 0) break;
    allLeads = allLeads.concat(chunk);
    if (chunk.length < limit) break;
    start += limit;
  }
  
  let campLeads = [];
  start = 0;
  while (true) {
    const { data: chunk } = await client.from('campaign_leads').select('lead_id').range(start, start + limit - 1);
    if (!chunk || chunk.length === 0) break;
    campLeads = campLeads.concat(chunk);
    if (chunk.length < limit) break;
    start += limit;
  }
  
  const assignedLeadIds = new Set(campLeads.map(cl => cl.lead_id));
  const unassigned = allLeads.filter(l => !assignedLeadIds.has(l.id));
  
  console.log(`Unassigned leads: ${unassigned.length}`);
  
  let linkedCount = 0;
  
  for (const lead of unassigned) {
    const searchText = `${lead.company || ''} ${lead.industry || ''} ${lead.summary || ''}`.toLowerCase();
    
    // Find best campaign
    let bestCampaignId = null;
    let maxMatch = 0;
    
    for (const c of campaigns) {
      const keywords = (c.niche || c.name || '').toLowerCase().split(' ');
      let matchCount = 0;
      for (const kw of keywords) {
        if (kw.length > 3 && searchText.includes(kw)) {
          matchCount++;
        }
      }
      
      // Some special fast keywords
      if (c.name.toLowerCase().includes('legal') || c.name.toLowerCase().includes('law')) {
        if (searchText.includes('law') || searchText.includes('legal') || searchText.includes('solicitor')) matchCount += 5;
      }
      if (c.name.toLowerCase().includes('property') || c.name.toLowerCase().includes('real estate')) {
        if (searchText.includes('property') || searchText.includes('real estate') || searchText.includes('estate')) matchCount += 5;
      }
      if (c.name.toLowerCase().includes('dental')) {
        if (searchText.includes('dental') || searchText.includes('dentist')) matchCount += 5;
      }
      
      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        bestCampaignId = c.id;
      }
    }
    
    if (bestCampaignId && maxMatch > 0) {
      const { error } = await client.from('campaign_leads').upsert({
        campaign_id: bestCampaignId,
        lead_id: lead.id
      }, { onConflict: 'campaign_id,lead_id' });
      
      if (!error) linkedCount++;
    }
  }
  
  console.log(`Successfully linked ${linkedCount} unassigned leads to campaigns.`);
  
  // Update counts
  for (const c of campaigns) {
    const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
    await client.from('campaigns').update({ prospects: count }).eq('id', c.id);
  }
}

main();
