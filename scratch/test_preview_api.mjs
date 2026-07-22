import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Let's find any campaign with leads
  const { data: campaigns } = await supabase.from('campaigns').select('id, name');
  
  for (const camp of campaigns) {
    const { data: campLeads, error } = await supabase
      .from('campaign_leads')
      .select('*, leads(*)')
      .eq('campaign_id', camp.id)
      .limit(1);
      
    console.log(`Campaign: "${camp.name}" (${camp.id})`);
    console.log(`- campLeads error:`, error);
    console.log(`- campLeads result:`, JSON.stringify(campLeads, null, 2));
  }
}

run().catch(console.error);
