import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, name');
  
  for (const campaign of campaigns) {
    const { count, error } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    console.log(`Campaign: "${campaign.name}" | Template Count: ${count}`);
  }
}

run().catch(console.error);
