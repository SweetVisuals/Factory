import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('leads').upsert({
    user_id: '012255f9-05de-4121-b263-989e3a7d0066', // invalid user
    email: 'test@example.com',
    company: 'Test'
  }, { onConflict: 'user_id,website,email' });
  
  console.log("Upsert error:", error);
}

check();
