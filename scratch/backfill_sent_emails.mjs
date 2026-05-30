
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfill() {
  console.log("Starting backfill of inbox_emails from campaign_progress...");

  // Get all 'sent' records from campaign_progress that don't have a matching entry in inbox_emails
  // Note: We can't easily join across tables in a simple way to find 'missing', 
  // so we'll fetch sent records and check manually or just insert if we know they are missing.
  
  const { data: sentProgress, error } = await supabase
    .from('campaign_progress')
    .select(`
      *,
      leads (
        email,
        personalized_subject,
        personalized_email,
        name
      ),
      scheduled_emails (
        templates (
          name,
          subject,
          content
        )
      ),
      email_accounts (
        email
      )
    `)
    .eq('status', 'sent')
    .not('sent_at', 'is', null);

  if (error) {
    console.error("Error fetching progress:", error);
    return;
  }

  console.log(`Found ${sentProgress.length} sent progress records.`);

  for (const record of sentProgress) {
    // Check if it already exists in inbox_emails
    const { data: existing } = await supabase
      .from('inbox_emails')
      .select('id')
      .eq('campaign_id', record.campaign_id)
      .eq('to', record.leads.email)
      .eq('folder', 'sent')
      .maybeSingle();

    if (existing) {
      console.log(`Email to ${record.leads.email} already in inbox_emails. Skipping.`);
      continue;
    }

    const subject = record.leads.personalized_subject || record.scheduled_emails.templates.subject;
    const body = record.leads.personalized_email || record.scheduled_emails.templates.content;

    const { error: insertErr } = await supabase
      .from('inbox_emails')
      .insert({
        email_account_id: record.email_account_id,
        folder: 'sent',
        uid: Math.floor(Math.random() * 1000000000),
        from: record.email_accounts.email,
        to: record.leads.email,
        subject: subject,
        body_text: body,
        body_html: body.replace(/\n/g, '<br/>'),
        snippet: body.substring(0, 100),
        received_at: record.sent_at,
        is_read: true,
        campaign_id: record.campaign_id,
        sequence_step: record.scheduled_emails.templates.name
      });

    if (insertErr) {
      console.error(`Error inserting for ${record.leads.email}:`, insertErr);
    } else {
      console.log(`Backfilled sent email for ${record.leads.email}`);
    }
  }

  console.log("Backfill complete.");
}

backfill();
