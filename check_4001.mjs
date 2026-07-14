import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: campaigns, error } = await supabase.from('campaigns').select('id, name, prospects');
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  for (const c of campaigns) {
    const { count: leadsCount } = await supabase.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
    console.log(`Campaign: ${c.name}`);
    console.log(`  prospects column: ${c.prospects}`);
    console.log(`  campaign_leads count: ${leadsCount}`);
  }
  
  // also check if there's a PostgREST limit or if any count is exactly 4001
}
main().catch(console.error);
