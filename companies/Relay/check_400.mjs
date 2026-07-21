import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testUpdate() {
  const payload = {
    name: "Relay Dental Outreach Q3 TEST",
    open_rate: 0,
    prospects: 0,
    replies: 0,
    openRate: "0%",
    sent: "0"
  };
  
  const { data, error } = await supabase
    .from('campaigns')
    .update(payload)
    .eq('id', '48813878-c1af-46f8-9c02-7c3f30e445b4');
    
  console.log("Anon update status:", { data, error });
}

testUpdate().catch(console.error);
