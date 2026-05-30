import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: 'companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data: campaignLeads, error } = await supabase.from('campaign_leads').select('campaign_id, lead_id');
  if (error) console.error(error);
  
  const { data: leads } = await supabase.from('leads').select('id, status');
  const leadsMap = {};
  for(const l of leads || []) leadsMap[l.id] = l.status;
  
  const stats = {};
  for(const cl of campaignLeads || []) {
    const status = leadsMap[cl.lead_id] || 'Unknown';
    if(!stats[cl.campaign_id]) stats[cl.campaign_id] = { total: 0, byStatus: {} };
    stats[cl.campaign_id].total++;
    stats[cl.campaign_id].byStatus[status] = (stats[cl.campaign_id].byStatus[status] || 0) + 1;
  }
  
  const { data: camps } = await supabase.from('campaigns').select('id, name');
  for(const c of camps || []) {
    if(stats[c.id]) {
      console.log(`Campaign ${c.name} (${c.id.split('-')[0]}): Total ${stats[c.id].total}`, stats[c.id].byStatus);
    } else {
      console.log(`Campaign ${c.name} (${c.id.split('-')[0]}): 0 leads`);
    }
  }
}
check();
