import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('campaign_stats').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  let total = 0;
  for (const c of data) {
    total += (c.actual_prospects || 0);
  }
  console.log(`Total actual_prospects: ${total}`);
  console.log(data.map(c => `${c.name}: ${c.actual_prospects}`).join('\n'));
}

check();
