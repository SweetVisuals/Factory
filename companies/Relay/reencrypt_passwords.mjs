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

  const targetPassword = 'Longlonglong1!';

  // Generate the new encrypted password
  const { data: newEncrypted, error: encryptError } = await client.rpc('encrypt_password', { password: targetPassword });
  if (encryptError) {
      console.error('Encrypt Error:', encryptError);
      return;
  }
  
  console.log(`Newly encrypted password generated.`);

  const { data: accounts } = await client.from('email_accounts').select('id, email, encrypted_password');
  
  if (accounts) {
      console.log(`Found ${accounts.length} accounts.`);
      for (const acc of accounts) {
          const { data: decrypted } = await client.rpc('decrypt_password', { encrypted_password: acc.encrypted_password });
          console.log(`Account: ${acc.email} | Current Decrypted: ${decrypted}`);
          
          if (decrypted !== targetPassword) {
              const { error: updateErr } = await client.from('email_accounts')
                  .update({ encrypted_password: newEncrypted })
                  .eq('id', acc.id);
              if (updateErr) {
                  console.error(`Failed to update ${acc.email}:`, updateErr);
              } else {
                  console.log(`✅ Updated password for ${acc.email}`);
              }
          } else {
              console.log(`⚡ Password already correct for ${acc.email}`);
          }
      }
  } else {
      console.log('No accounts found.');
  }

  // Force trigger campaign after update
  console.log('Triggering process-campaign...');
  const { data: invokeResult } = await client.functions.invoke('process-campaign');
  console.log('Invoke Result:', invokeResult);
}
main();
