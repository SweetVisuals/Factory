import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: memData } = await supabase.from('agent_memory').select('*');
  console.log(JSON.stringify(memData, null, 2));
}
main().catch(console.error);
