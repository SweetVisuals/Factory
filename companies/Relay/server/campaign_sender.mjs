/**
 * Universal Campaign Sender — Hetzner PM2 Job
 * 
 * Sends pre-drafted personalized emails for ALL active campaigns.
 * Processes one campaign at a time, all leads sequentially with 45-90s delays.
 * 
 * Usage: pm2 start server/campaign_sender.mjs --name campaign-sender
 */
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Configuration ───────────────────────────────────────────────────────────
const SENDER_EMAIL = 'nicolas@relaysolutions.net';
const SENDER_NAME = 'Nicolas';
const SENDER_PHONE = '+44 7864 851184';
const MIN_DELAY_SEC = 45;
const MAX_DELAY_SEC = 90;
const BATCH_SIZE = 20;

const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com',
  'live.co.uk', 'btinternet.com', 'sky.com', 'googlemail.com', 'nhs.net',
  'macmillan.org.uk'
];

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── SMTP ────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'mail.privateemail.com',
  port: 465,
  secure: true,
  auth: { user: SENDER_EMAIL, pass: 'Longlonglong1!' },
  tls: { rejectUnauthorized: false },
  pool: true,
  maxConnections: 1,
  maxMessages: 5,
  rateDelta: 60000,
  rateLimit: 10
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomDelay() {
  return (Math.floor(Math.random() * (MAX_DELAY_SEC - MIN_DELAY_SEC + 1)) + MIN_DELAY_SEC) * 1000;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(`[${new Date().toISOString()}] [Sender] ${msg}`); }

function buildFullEmail(body) {
  return `${body}

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

// ─── Fetch pending batch for a campaign ──────────────────────────────────────
async function fetchPendingBatch(campaignId) {
  const { data, error } = await supabase
    .from('campaign_leads')
    .select('lead_id, leads!inner(id, email, name, company, personalized_email, personalized_subject)')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(BATCH_SIZE);

  if (error) { log(`❌ Fetch error: ${error.message}`); return []; }

  return (data || []).filter(cl => {
    const l = cl.leads;
    if (!l?.email?.trim() || !l.personalized_email?.trim() || !l.personalized_subject?.trim()) return false;
    const domain = l.email.split('@')[1]?.toLowerCase();
    if (!domain || !domain.includes('.')) return false;
    if (PERSONAL_DOMAINS.includes(domain)) return false;
    return true;
  });
}

// ─── Skip invalid leads ─────────────────────────────────────────────────────
async function skipInvalidLeads(campaignId) {
  const { data } = await supabase
    .from('campaign_leads')
    .select('lead_id, leads!inner(id, email, personalized_email)')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(200);

  if (!data) return 0;
  let skipped = 0;
  for (const cl of data) {
    const l = cl.leads;
    const bad = !l?.email?.trim() || !l.personalized_email?.trim() ||
                !l.email.includes('@') || !l.email.split('@')[1]?.includes('.') ||
                PERSONAL_DOMAINS.includes(l.email.split('@')[1]?.toLowerCase());
    if (bad) {
      await supabase.from('campaign_leads')
        .update({ status: 'skipped' })
        .eq('campaign_id', campaignId)
        .eq('lead_id', l.id);
      skipped++;
    }
  }
  return skipped;
}

// ─── Send one email ─────────────────────────────────────────────────────────
async function sendEmail(lead) {
  return transporter.sendMail({
    from: `"Nicolas — Relay Solutions" <${SENDER_EMAIL}>`,
    to: lead.email,
    subject: lead.personalized_subject,
    text: buildFullEmail(lead.personalized_email),
    headers: {
      'X-Mailer': 'Relay Campaign Engine',
      'List-Unsubscribe': `<mailto:${SENDER_EMAIL}?subject=unsubscribe>`,
    }
  });
}

// ─── Process one campaign ────────────────────────────────────────────────────
async function processCampaign(campaign) {
  log(`\n═══ CAMPAIGN: ${campaign.name} ═══`);

  // Skip invalid leads first
  const skipped = await skipInvalidLeads(campaign.id);
  if (skipped > 0) log(`🧹 Skipped ${skipped} invalid leads`);

  let sent = 0, failed = 0, consecutiveEmpty = 0;

  while (consecutiveEmpty < 3) {
    const batch = await fetchPendingBatch(campaign.id);

    if (batch.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty < 3) {
        const moreSkipped = await skipInvalidLeads(campaign.id);
        if (moreSkipped > 0) { consecutiveEmpty = 0; continue; }
        log(`⏳ No pending leads (attempt ${consecutiveEmpty}/3). Waiting 30s...`);
        await sleep(30000);
      }
      continue;
    }
    consecutiveEmpty = 0;

    for (let i = 0; i < batch.length; i++) {
      const lead = batch[i].leads;
      const count = sent + failed + 1;

      try {
        log(`[${count}] → ${lead.email} (${lead.company})`);
        log(`  Subject: ${lead.personalized_subject}`);

        const info = await sendEmail(lead);
        log(`  ✅ SENT — ${info.messageId}`);
        sent++;

        await supabase.from('campaign_leads')
          .update({ status: 'sent', last_sent_at: new Date().toISOString() })
          .eq('campaign_id', campaign.id)
          .eq('lead_id', lead.id);

        await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id);

      } catch (err) {
        log(`  ❌ FAILED — ${lead.email}: ${err.message}`);
        failed++;

        await supabase.from('campaign_leads')
          .update({ status: 'failed' })
          .eq('campaign_id', campaign.id)
          .eq('lead_id', lead.id);

        if (err.message.includes('ECONNRESET') || err.message.includes('socket') || err.message.includes('ETIMEDOUT')) {
          log('  ⚠️ Connection error — waiting 120s...');
          await sleep(120000);
          try { await transporter.verify(); log('  ✅ SMTP re-verified'); }
          catch (e) { log(`  ❌ SMTP re-verify failed: ${e.message}`); }
        }
      }

      // Delay between sends
      if (i < batch.length - 1) {
        const d = randomDelay();
        log(`  ⏳ ${Math.round(d / 1000)}s...`);
        await sleep(d);
      }
    }

    // Delay between batches
    const bd = randomDelay();
    log(`  ⏳ Batch done. ${Math.round(bd / 1000)}s...`);
    await sleep(bd);
  }

  log(`═══ ${campaign.name} DONE: ✅ ${sent} sent | ❌ ${failed} failed ═══`);
  return { sent, failed };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log('  UNIVERSAL CAMPAIGN SENDER — ALL ACTIVE CAMPAIGNS');
  log(`  Sender: ${SENDER_EMAIL}`);
  log(`  Delay: ${MIN_DELAY_SEC}–${MAX_DELAY_SEC}s between emails`);
  log('═══════════════════════════════════════════════════════════════');

  // Verify SMTP
  try {
    await transporter.verify();
    log('✅ SMTP connection verified');
  } catch (err) {
    log(`❌ SMTP failed: ${err.message}. Retrying in 60s...`);
    await sleep(60000);
    try { await transporter.verify(); log('✅ SMTP verified on retry'); }
    catch (e) { log(`❌ SMTP still failing: ${e.message}. Exiting.`); process.exit(1); }
  }

  // Get all active campaigns with pending leads
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, niche, status')
    .eq('status', 'active')
    .order('name');

  if (error || !campaigns) { log(`❌ Campaign fetch failed: ${error?.message}`); process.exit(1); }

  log(`\n📋 Active campaigns: ${campaigns.length}`);
  for (const c of campaigns) log(`  • ${c.name}`);

  let totalSent = 0, totalFailed = 0;

  for (const campaign of campaigns) {
    const { sent, failed } = await processCampaign(campaign);
    totalSent += sent;
    totalFailed += failed;
  }

  log('\n═══════════════════════════════════════════════════════════════');
  log('  ALL CAMPAIGNS COMPLETE');
  log('═══════════════════════════════════════════════════════════════');
  log(`  ✅ Total sent:   ${totalSent}`);
  log(`  ❌ Total failed: ${totalFailed}`);
  log('═══════════════════════════════════════════════════════════════');

  transporter.close();
  process.exit(0);
}

main().catch(err => { log(`💀 FATAL: ${err.message}`); console.error(err); process.exit(1); });
