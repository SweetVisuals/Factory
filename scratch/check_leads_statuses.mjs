import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function main() {
  console.log('Querying leads statuses...');
  const { data: leads, error: errorLeads } = await supabase
    .from('leads')
    .select('status');
  
  if (errorLeads) {
    console.error('Error fetching leads:', errorLeads);
    process.exit(1);
  }

  const countsLeads = {};
  for (const row of leads || []) {
    countsLeads[row.status] = (countsLeads[row.status] || 0) + 1;
  }
  console.log('Leads status counts:', countsLeads);

  console.log('Querying campaign_progress entries with status = bounced or failed...');
  const { data: progress, error: errorProgress } = await supabase
    .from('campaign_progress')
    .select('status, updated_at')
    .in('status', ['bounced', 'failed']);

  if (errorProgress) {
    console.error('Error fetching progress:', errorProgress);
    process.exit(1);
  }

  console.log('Total failed/bounced progress entries:', progress.length);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
