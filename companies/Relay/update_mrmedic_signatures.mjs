import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData) return;
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const mockEmails = [
    { email: 'clara@mrmedicevents.co.uk', name: 'Clara' },
    { email: 'steve@mrmedicevents.co.uk', name: 'Steve' },
    { email: 'jessica@mrmedicevents.co.uk', name: 'Jessica' }
  ];

  for (const me of mockEmails) {
    const signature = `${me.name}\nMrMedic Events Ltd\n${me.email}\n--\nThis email was sent by MrMedic Events Ltd. You are receiving this because we believe our event medical services may be relevant to your organisation's health and safety. If you would prefer not to receive future emails, please reply with "Unsubscribe" or click [Unsubscribe].`;
    
    const { error } = await client
      .from('email_accounts')
      .update({ signature })
      .eq('email', me.email);

    if (error) {
      console.error(`Error updating signature for ${me.email}:`, error.message);
    } else {
      console.log(`Updated signature for ${me.email}`);
    }
  }
}

main().catch(console.error);
