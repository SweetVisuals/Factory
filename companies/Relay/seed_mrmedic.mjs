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
  if (!authData) {
    console.error("Authentication failed");
    return;
  }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const userId = authData.user.id;
  console.log("Authenticated as user:", userId);

  // 1. Insert MrMedic Events Business
  const { data: existingBiz, error: checkBizErr } = await client
    .from('businesses')
    .select('id')
    .eq('slug', 'mrmedic')
    .maybeSingle();

  if (checkBizErr) {
    console.error("Error checking business:", checkBizErr.message);
    return;
  }

  let businessId;
  if (!existingBiz) {
    const overviewMd = `# MrMedic Events Ltd\n\n## Overview\nProfessional on-site paramedics and nurses for events across London and the Midlands.\n\n## Core Operations\n- Paras/Nurses: Qualified clinical professionals (HCPC/NMC registered) - not volunteers.\n- Cover Types: Sports events, community events, charity events, festivals, school events, and private functions.\n- Areas: London and the Midlands (Birmingham, Coventry, Wolverhampton, Walsall, etc.)\n- Simple Bookings: Fast confirmation within 48 hours.`;
    
    const { data: newBiz, error: insertBizErr } = await client
      .from('businesses')
      .insert({
        name: 'MrMedic Events',
        slug: 'mrmedic',
        overview_md: overviewMd,
        status: 'active'
      })
      .select('id')
      .single();

    if (insertBizErr) {
      console.error("Error inserting business:", insertBizErr.message);
      return;
    }
    businessId = newBiz.id;
    console.log("Created MrMedic business:", businessId);
  } else {
    businessId = existingBiz.id;
    console.log("MrMedic business already exists:", businessId);
  }

  // 2. Insert targets for MrMedic
  const targets = [
    {
      name: 'Gymnastics Clubs',
      description: 'Independent gymnastics clubs running in-house competitions, annual displays, and inter-club events in London.'
    },
    {
      name: 'Amateur Rugby Clubs',
      description: 'Community-level RFU affiliated clubs running fixtures, tournaments and 7s events in the Midlands.'
    },
    {
      name: 'Outdoor Fitness & Bootcamps',
      description: 'Owner-run outdoor fitness classes, bootcamps in parks, and personal trainers running group sessions.'
    },
    {
      name: 'Community Music Venues',
      description: 'Independent live music venues, multi-use arts spaces, and bar-venues with 100-800 capacity.'
    },
    {
      name: 'Dance Schools',
      description: 'Owner-run dance schools hosting annual showcases, end-of-year performances, and studio recitals.'
    }
  ];

  for (const t of targets) {
    const { data: existingTarget } = await client
      .from('business_targets')
      .select('id')
      .eq('business_id', businessId)
      .eq('name', t.name)
      .maybeSingle();

    if (!existingTarget) {
      const { data: newTarget, error: insertTargetErr } = await client
        .from('business_targets')
        .insert({
          business_id: businessId,
          name: t.name,
          description: t.description,
          status: 'active'
        })
        .select('id')
        .single();

      if (insertTargetErr) {
        console.error(`Error inserting target ${t.name}:`, insertTargetErr.message);
      } else {
        console.log(`Created target "${t.name}":`, newTarget.id);
      }
    } else {
      console.log(`Target "${t.name}" already exists:`, existingTarget.id);
    }
  }

  // 3. Insert mock MrMedic email accounts if they do not exist
  const mockEmails = [
    { email: 'clara@mrmedicevents.co.uk', name: 'Clara' },
    { email: 'steve@mrmedicevents.co.uk', name: 'Steve' },
    { email: 'jessica@mrmedicevents.co.uk', name: 'Jessica' }
  ];

  for (const me of mockEmails) {
    const { data: existingEmail } = await client
      .from('email_accounts')
      .select('id')
      .eq('email', me.email)
      .maybeSingle();

    if (!existingEmail) {
      const { data: newEmail, error: insertEmailErr } = await client
        .from('email_accounts')
        .insert({
          user_id: userId,
          email: me.email,
          name: me.name,
          imap_host: 'mrmedicevents.co.uk',
          imap_port: '993',
          smtp_host: 'mrmedicevents.co.uk',
          smtp_port: '465',
          encrypted_password: 'mock_password_for_agent_testing',
          warmup_enabled: false,
          warmup_status: 'disabled',
          health_score: 100
        })
        .select('id')
        .single();

      if (insertEmailErr) {
        console.error(`Error inserting email account ${me.email}:`, insertEmailErr.message);
      } else {
        console.log(`Created email account "${me.email}":`, newEmail.id);
      }
    } else {
      console.log(`Email account "${me.email}" already exists:`, existingEmail.id);
    }
  }
}

main().catch(console.error);
