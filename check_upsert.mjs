import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const leadData = {
    user_id: '012255f9-05de-4121-b263-989e3a7d0066', // invalid user ID
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
