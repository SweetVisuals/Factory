import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function main() {
  console.log('Querying campaign_progress statuses...');
  const { data, error } = await supabase
    .from('campaign_progress')
    .select('status');
  
  if (error) {
    console.error('Error fetching campaign_progress:', error);
    process.exit(1);
  }

  const counts = {};
  for (const row of data || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  console.log('Campaign progress status counts:', counts);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
