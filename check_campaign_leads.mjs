import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

async function check() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { count: clCount, error: clError } = await supabase.from('campaign_leads').select('*', { count: 'exact', head: true });
  console.log('campaign_leads count:', clCount, clError);
}

check();
