import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('leads').select('email');
  const emails = data.map(d => d.email);
  const uniqueEmails = new Set(emails);
  console.log(`Total leads: ${emails.length}`);
  console.log(`Unique emails: ${uniqueEmails.size}`);
}

check();
