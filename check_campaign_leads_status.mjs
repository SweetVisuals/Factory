import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  let allStatuses = [];
  let start = 0;
  const limit = 1000;
  while (true) {
    const { data: chunk } = await supabase.from('campaign_leads').select('status').range(start, start + limit - 1);
    if (!chunk || chunk.length === 0) break;
    allStatuses = allStatuses.concat(chunk);
    if (chunk.length < limit) break;
    start += limit;
  }
  
  const countsMap = {};
  for(let row of allStatuses) {
    countsMap[row.status] = (countsMap[row.status] || 0) + 1;
  }
  console.log("Status counts in campaign_leads:", countsMap);
}

check();
