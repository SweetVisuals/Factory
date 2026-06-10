import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const passwordToUse = 'Longlonglong1!';

  // Sign in to get auth token so we can encrypt the password using the RPC
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  
  let client = supabase;
  if (!authErr) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });
  } else {
      console.log('Failed to sign in. Proceeding with service role.', authErr.message);
  }

  const { data: encryptedPassword, error: encryptError } = await client.rpc('encrypt_password', { password: passwordToUse });
  if (encryptError) {
    console.error('Failed to encrypt password:', encryptError.message);
    return;
  }

  const targetEmails = [
    'emma@relaysolutions.net',
    'ethan@relaysolutions.net',
    'jordan@relaysolutions.net',
    'oliver@relaysolutions.net'
  ];

  // Let's get ALL current emails
  const { data: accounts, error } = await supabase.from('email_accounts').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  // We want to delete the ones that are not in targetEmails
  for (const account of accounts) {
      if (!targetEmails.includes(account.email)) {
          console.log(`Deleting ${account.email}...`);
          // Let's delete from campaign_email_accounts first
          await supabase.from('campaign_email_accounts').delete().eq('email_account_id', account.id);
          const { error: delErr } = await supabase.from('email_accounts').delete().eq('id', account.id);
          if (delErr) {
              console.log(`Failed to delete ${account.email}: ${delErr.message}. Disabling instead.`);
              // if it fails to delete due to FK, let's just scramble the email or disable it
              await supabase.from('email_accounts').update({ warmup_status: 'disabled', email: `archived_${account.id}@archived.com` }).eq('id', account.id);
          } else {
              console.log(`Deleted ${account.email}`);
          }
      }
  }

  // Now insert or update the target emails
  for (const email of targetEmails) {
      const name = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
      
      const { data: existing } = await supabase.from('email_accounts').select('id').eq('email', email).maybeSingle();
      if (existing) {
          console.log(`Updating ${email}...`);
          await supabase.from('email_accounts').update({
              imap_host: 'mail.privateemail.com',
              imap_port: 993,
              smtp_host: 'mail.privateemail.com',
              smtp_port: 465,
              encrypted_password: encryptedPassword,
              warmup_status: 'enabled'
          }).eq('id', existing.id);
      } else {
          console.log(`Inserting ${email}...`);
          await supabase.from('email_accounts').insert({
              user_id: 'c5f44ad2-63d1-43c2-8e17-0333d12e8643', // valid user id
              email: email,
              name: name,
              imap_host: 'mail.privateemail.com',
              imap_port: 993,
              smtp_host: 'mail.privateemail.com',
              smtp_port: 465,
              encrypted_password: encryptedPassword,
              warmup_enabled: true,
              warmup_status: 'enabled',
              health_score: 100
          });
      }
  }
  console.log("Done updating email accounts.");
}

main().catch(console.error);
