import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTasks() {
  const { count, error } = await supabase
    .from('scrape_history')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error('Error fetching count:', error.message);
  } else {
    console.log(`Found ${count} scrape history records.`);
  }
}

checkTasks();
