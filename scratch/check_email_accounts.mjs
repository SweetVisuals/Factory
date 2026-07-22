import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: accounts, error } = await supabase
    .from('email_accounts')
    .select('id, email, name');
    
  console.log('email_accounts rows:', accounts, error);
}

run().catch(console.error);
