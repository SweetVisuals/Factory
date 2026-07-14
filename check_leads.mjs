import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLeads() {
  const { count, error } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error('Error fetching leads count:', error.message);
  } else {
    console.log(`Current leads count: ${count}`);
  }
}

checkLeads();
