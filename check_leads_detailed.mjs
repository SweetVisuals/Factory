import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('leads').select('id, email, campaign_id').limit(10);
  console.log('Sample leads:');
  console.log(data);
  
  // count leads with email
  const { count: withEmail } = await supabase.from('leads').select('*', { count: 'exact', head: true }).not('email', 'is', null);
  console.log('Leads with email:', withEmail);
  
  // count leads without email
  const { count: withoutEmail } = await supabase.from('leads').select('*', { count: 'exact', head: true }).is('email', null);
  console.log('Leads without email:', withoutEmail);
  
  // count leads with campaign_id
  const { count: withCampaign } = await supabase.from('leads').select('*', { count: 'exact', head: true }).not('campaign_id', 'is', null);
  console.log('Leads with campaign_id:', withCampaign);
}

check();
