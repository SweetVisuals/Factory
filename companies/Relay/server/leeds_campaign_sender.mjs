/**
 * Leeds Property Management Campaign — SMTP Sender (Hetzner PM2 Job)
 * 
 * This script runs as a standalone PM2 process on Hetzner.
 * It reads pre-drafted personalized emails from the database and sends them
 * via SMTP with randomized delays between 45–90 seconds.
 * 
 * Usage: pm2 start server/leeds_campaign_sender.mjs --name leeds-sender
 * 
 * The script will:
 * 1. Pick up pending leads (batch of 20 at a time)
 * 2. Send each via SMTP with signature + unsubscribe footer
 * 3. Update DB status to 'sent' or 'failed'
 * 4. Sleep 45-90s between sends
 * 5. Loop until all leads are sent, then exit
 */
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Configuration ───────────────────────────────────────────────────────────
const CAMPAIGN_ID = 'a750722b-e79c-4128-a32f-52aa3ef4e5ff';
const SENDER_EMAIL = 'nicolas@relaysolutions.net';
const SENDER_NAME = 'Nicolas';
const SENDER_PHONE = '+44 7864 851184';
const MIN_DELAY_SEC = 45;
const MAX_DELAY_SEC = 90;
const BATCH_SIZE = 20; // Fetch 20 pending leads at a time

// Personal email domains to skip
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com',
  'live.co.uk', 'btinternet.com', 'sky.com', 'googlemail.com'
];

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── SMTP Transport ──────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 465,
  secure: true,
  auth: {
    user: SENDER_EMAIL,
    pass: 'Longlonglong1!'
  },
  tls: { rejectUnauthorized: false },
  pool: true,
  maxConnections: 1,
  maxMessages: 5,
  rateDelta: 60000,
  rateLimit: 10
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomDelay() {
  const seconds = Math.floor(Math.random() * (MAX_DELAY_SEC - MIN_DELAY_SEC + 1)) + MIN_DELAY_SEC;
  return seconds * 1000;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Leeds Sender] ${msg}`);
}

function buildFullEmail(personalizedBody) {
  return `${personalizedBody}

${SENDER_NAME}
Relay — AI & Automation Systems
${SENDER_PHONE}
${SENDER_EMAIL}
www.relaysolutions.net

---
Relay Solutions Ltd · relaysolutions.net
You're receiving this because we believe our automation systems are relevant to your business operations.
To unsubscribe, reply with "unsubscribe" in the subject line.`;
}

// ─── Fetch next batch of pending leads ───────────────────────────────────────
async function fetchPendingBatch() {
  const { data: rows, error } = await supabase
    .from('campaign_leads')
    .select(`
      lead_id,
      status,
      leads!inner (
        id, email, name, company, personalized_email, personalized_subject
      )
    `)
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'pending')
    .limit(BATCH_SIZE);

  if (error) {
    log(`❌ DB fetch error: ${error.message}`);
    return [];
  }

  // Filter to valid, drafted business emails
  return (rows || []).filter(cl => {
    const lead = cl.leads;
    if (!lead?.email || lead.email.trim() === '') return false;
    if (!lead.personalized_email || lead.personalized_email.trim() === '') return false;
    if (!lead.personalized_subject || lead.personalized_subject.trim() === '') return false;
    const domain = lead.email.split('@')[1]?.toLowerCase();
    if (!domain || !domain.includes('.')) return false;
    if (PERSONAL_DOMAINS.includes(domain)) return false;
    return true;
  });
}

// ─── Mark leads without drafts as skipped ────────────────────────────────────
async function skipUndraftedLeads() {
  // Find pending leads that have no personalized content and mark them so we don't loop on them
  const { data: rows } = await supabase
    .from('campaign_leads')
    .select('lead_id, leads!inner(id, email, personalized_email)')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'pending')
    .limit(100);

  if (!rows) return 0;

  let skipped = 0;
  for (const cl of rows) {
    const lead = cl.leads;
    const shouldSkip = (
      !lead?.email || lead.email.trim() === '' ||
      !lead.personalized_email || lead.personalized_email.trim() === '' ||
      !lead.email.includes('@') || !lead.email.split('@')[1]?.includes('.')
    );

    if (shouldSkip) {
      await supabase
        .from('campaign_leads')
        .update({ status: 'skipped' })
        .eq('campaign_id', CAMPAIGN_ID)
        .eq('lead_id', lead.id);
      skipped++;
    }
  }
  return skipped;
}

// ─── Send a single email ─────────────────────────────────────────────────────
async function sendEmail(lead) {
  const fullBody = buildFullEmail(lead.personalized_email);

  const info = await transporter.sendMail({
    from: `"Nicolas — Relay Solutions" <${SENDER_EMAIL}>`,
    to: lead.email,
    subject: lead.personalized_subject,
    text: fullBody,
    headers: {
      'X-Mailer': 'Relay Campaign Engine',
      'List-Unsubscribe': `<mailto:${SENDER_EMAIL}?subject=unsubscribe>`,
    }
  });

  return info;
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log('  LEEDS PROPERTY MANAGEMENT CAMPAIGN — HETZNER SENDER');
  log(`  Campaign ID: ${CAMPAIGN_ID}`);
  log(`  Sender: ${SENDER_EMAIL}`);
  log(`  Delay: ${MIN_DELAY_SEC}–${MAX_DELAY_SEC}s between emails`);
  log('═══════════════════════════════════════════════════════════════');

  // Verify SMTP
  try {
    await transporter.verify();
    log('✅ SMTP connection verified');
  } catch (err) {
    log(`❌ SMTP connection FAILED: ${err.message}`);
    log('Will retry in 60 seconds...');
    await sleep(60000);
    try {
      await transporter.verify();
      log('✅ SMTP connection verified on retry');
    } catch (err2) {
      log(`❌ SMTP still failing: ${err2.message}. Exiting.`);
      process.exit(1);
    }
  }

  // First pass: skip leads that can't be sent (no email, no draft)
  const skipped = await skipUndraftedLeads();
  if (skipped > 0) {
    log(`🧹 Marked ${skipped} undrafted/invalid leads as 'skipped'`);
  }

  // Get initial count
  const { data: countData } = await supabase
    .from('campaign_leads')
    .select('lead_id', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'pending');

  const totalPending = countData?.length || 0;
  log(`📊 Pending leads to send: ~${totalPending}`);

  let totalSent = 0;
  let totalFailed = 0;
  let consecutiveEmpty = 0;

  // Main send loop — fetch batches until none remain
  while (consecutiveEmpty < 3) {
    const batch = await fetchPendingBatch();

    if (batch.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty < 3) {
        // Try skipping undrafted ones again
        const skippedMore = await skipUndraftedLeads();
        if (skippedMore > 0) {
          log(`🧹 Skipped ${skippedMore} more undrafted leads`);
          consecutiveEmpty = 0; // Reset — there might be more valid ones now
          continue;
        }
        log(`⏳ No pending leads found (attempt ${consecutiveEmpty}/3). Waiting 30s...`);
        await sleep(30000);
      }
      continue;
    }

    consecutiveEmpty = 0;

    for (let i = 0; i < batch.length; i++) {
      const lead = batch[i].leads;
      const globalCount = totalSent + totalFailed + i + 1;

      try {
        log(`[${globalCount}] Sending to: ${lead.email} (${lead.company})`);
        log(`  Subject: ${lead.personalized_subject}`);

        const info = await sendEmail(lead);
        log(`  ✅ SENT — Message ID: ${info.messageId}`);
        totalSent++;

        // Update campaign_leads status
        await supabase
          .from('campaign_leads')
          .update({ status: 'sent', last_sent_at: new Date().toISOString() })
          .eq('campaign_id', CAMPAIGN_ID)
          .eq('lead_id', lead.id);

        // Update lead status
        await supabase
          .from('leads')
          .update({ status: 'contacted' })
          .eq('id', lead.id);

      } catch (err) {
        log(`  ❌ FAILED — ${lead.email}: ${err.message}`);
        totalFailed++;

        await supabase
          .from('campaign_leads')
          .update({ status: 'failed' })
          .eq('campaign_id', CAMPAIGN_ID)
          .eq('lead_id', lead.id);

        // If SMTP connection died, wait longer before retrying
        if (err.message.includes('ECONNRESET') || err.message.includes('socket') || err.message.includes('ETIMEDOUT')) {
          log('  ⚠️  Connection error — waiting 120s before retrying...');
          await sleep(120000);
          // Re-verify SMTP
          try { await transporter.verify(); log('  ✅ SMTP re-verified'); }
          catch (e) { log(`  ❌ SMTP re-verify failed: ${e.message}`); }
        }
      }

      // Random delay between emails (skip after last in batch)
      if (i < batch.length - 1) {
        const delayMs = randomDelay();
        log(`  ⏳ Waiting ${Math.round(delayMs / 1000)}s...`);
        await sleep(delayMs);
      }
    }

    // Delay between batches too
    const batchDelay = randomDelay();
    log(`  ⏳ Batch complete. Waiting ${Math.round(batchDelay / 1000)}s before next batch...`);
    await sleep(batchDelay);
  }

  // ─── Final Summary ───────────────────────────────────────────────────────
  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  CAMPAIGN SEND COMPLETE');
  log('═══════════════════════════════════════════════════════════════');
  log(`  ✅ Sent:    ${totalSent}`);
  log(`  ❌ Failed:  ${totalFailed}`);
  log('═══════════════════════════════════════════════════════════════');

  transporter.close();
  process.exit(0);
}

main().catch(err => {
  log(`💀 FATAL ERROR: ${err.message}`);
  console.error(err);
  process.exit(1);
});
