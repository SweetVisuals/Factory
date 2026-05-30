import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData?.session) { console.log('Auth failed'); return; }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const { data: accounts } = await client
    .from('email_accounts')
    .select('id, email, status');

  console.log('All Email Accounts:');
  accounts?.forEach(a => console.log(`- ${a.email} [${a.status}]`));

  const { data: scheduleAccounts } = await client
    .from('schedule_email_accounts')
    .select('schedule_id, email_account_id');

  console.log(`\nFound ${scheduleAccounts?.length || 0} link(s) in schedule_email_accounts.`);
}
main();
