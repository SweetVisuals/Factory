import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const campaignId = 'a7d254de-9f22-485c-b3cb-a7ffb58eb9e2'; // UK Builders
  
  const { data: campLeads, error } = await supabase
    .from('campaign_leads')
    .select('leads!inner(*)')
    .eq('campaign_id', campaignId)
    .not('leads.email', 'eq', '')
    .not('leads.email', 'is', null)
    .limit(1);
    
  console.log('Error:', error);
  console.log('Result:', JSON.stringify(campLeads, null, 2));
}

run().catch(console.error);
