import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    return;
  }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  console.log('=== BUSINESSES ===');
  const { data: businesses, error: bizErr } = await client.from('businesses').select('*');
  if (bizErr) {
    console.error('Error fetching businesses:', bizErr.message);
  } else {
    businesses.forEach(b => {
      console.log(`- [${b.id}] ${b.name} (${b.slug})`);
    });
  }

  console.log('=== EMAIL ACCOUNTS ===');
  const { data: emailAccounts, error: emailErr } = await client.from('email_accounts').select('id, email, name');
  if (emailErr) {
    console.error('Error fetching email accounts:', emailErr.message);
  } else {
    emailAccounts.forEach(e => {
      console.log(`- [${e.id}] ${e.name} (${e.email})`);
    });
  }
}

main().catch(console.error);
