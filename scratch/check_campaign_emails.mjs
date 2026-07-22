import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: campaignEmails, error } = await supabase
    .from('campaign_email_accounts')
    .select('*');
    
  console.log('campaign_email_accounts rows:', campaignEmails, error);
}

run().catch(console.error);
