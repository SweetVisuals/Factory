import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_campaign_stats_test');
  // I will just use pg_catalog to read the view definition
  const { data: views, error: viewError } = await supabase
    .from('views')
    .select('*')
    .eq('viewname', 'campaign_stats');
}

check();
