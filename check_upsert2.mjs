import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const leadData = {
    user_id: undefined, // test undefined
    email: 'test@example.com',
    company: 'Test'
  };

  const result = await client
    .from('leads')
    .upsert(leadData, {
      onConflict: 'user_id,website,email',
      ignoreDuplicates: false
    })
    .select()
    .single();

  console.log("Upsert result:", result);
}

check();
