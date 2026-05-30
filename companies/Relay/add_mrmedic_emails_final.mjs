import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

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

  const userId = authData.user.id;
  const passwordToUse = 'Longlonglong1!';

  // Encrypt password using RPC
  const { data: encryptedPassword, error: encryptError } = await client.rpc('encrypt_password', { password: passwordToUse });
  
  if (encryptError) {
    console.error('Failed to encrypt password:', encryptError.message);
    return;
  }

  const emailsToAdd = [
    { email: 'anderson@mrmedicevents.org', name: 'Anderson' },
    { email: 'bennett@mrmedicevents.org', name: 'Bennett' },
    { email: 'byron@mrmedicevents.org', name: 'Byron' },
    { email: 'callum@mrmedicevents.org', name: 'Callum' },
    { email: 'cole@mrmedicevents.org', name: 'Cole' },
    { email: 'ester@mrmedicevents.org', name: 'Ester' },
    { email: 'info@mrmedicevents.org', name: 'Info' },
    { email: 'lawson@mrmedicevents.org', name: 'Lawson' },
    { email: 'lucas@mrmedicevents.org', name: 'Lucas' },
    { email: 'marian@mrmedicevents.org', name: 'Marian' },
    { email: 'richard@mrmedicevents.org', name: 'Richard' }
  ];

  const emailAccountIds = [];

  for (const acc of emailsToAdd) {
    const { data: existingEmail } = await client
      .from('email_accounts')
      .select('id')
      .eq('email', acc.email)
      .maybeSingle();

    if (!existingEmail) {
      const { data: newEmail, error: insertEmailErr } = await client
        .from('email_accounts')
        .insert({
          user_id: userId,
          email: acc.email,
          name: acc.name,
          imap_host: 'mrmedicevents.org',
          imap_port: '993',
          smtp_host: 'mrmedicevents.org',
          smtp_port: '465',
          encrypted_password: encryptedPassword,
          warmup_enabled: false,
          warmup_status: 'disabled',
          health_score: 100
        })
        .select('id')
        .single();

      if (insertEmailErr) {
        console.error(`Error inserting ${acc.email}:`, insertEmailErr.message);
      } else {
        console.log(`Created email account ${acc.email}:`, newEmail.id);
        emailAccountIds.push(newEmail.id);
      }
    } else {
      console.log(`Email account ${acc.email} already exists:`, existingEmail.id);
      
      // Update its credentials just in case
      await client.from('email_accounts').update({
          imap_host: 'mrmedicevents.org',
          imap_port: '993',
          smtp_host: 'mrmedicevents.org',
          smtp_port: '465',
          encrypted_password: encryptedPassword
      }).eq('id', existingEmail.id);
      
      emailAccountIds.push(existingEmail.id);
    }
  }

  // Find MrMedic campaigns
  const { data: campaigns, error: campErr } = await client
    .from('campaigns')
    .select('id, name')
    .eq('business_id', '0269fe06-4607-4c58-9263-12a3930a1dc3'); // From our previous fetch

  if (campErr) {
    console.error('Error fetching campaigns:', campErr.message);
    return;
  }

  console.log('Found MrMedic campaigns:', campaigns.map(c => c.name));

  for (const campaign of campaigns) {
    for (const emailId of emailAccountIds) {
      const { data: existingLink } = await client
        .from('campaign_email_accounts')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('email_account_id', emailId)
        .maybeSingle();

      if (!existingLink) {
        const { error: linkErr } = await client
          .from('campaign_email_accounts')
          .insert({
            campaign_id: campaign.id,
            email_account_id: emailId
          });

        if (linkErr) {
          console.error(`Error linking ${emailId} to ${campaign.id}:`, linkErr.message);
        } else {
          console.log(`Linked email ${emailId} to campaign ${campaign.name}`);
        }
      } else {
         console.log(`Already linked email ${emailId} to campaign ${campaign.name}`);
      }
    }
  }
  console.log('All done!');
}

main().catch(console.error);
