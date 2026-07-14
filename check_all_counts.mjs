import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { count: cLeads } = await supabase.from('campaign_leads').select('*', { count: 'exact', head: true });
  console.log('campaign_leads count:', cLeads);
  
  // check leads count again
  const { count: leads } = await supabase.from('leads').select('*', { count: 'exact', head: true });
  console.log('leads count:', leads);
}

check();
