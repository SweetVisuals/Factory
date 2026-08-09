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
  port: 587,
  secure: false, // Use STARTTLS on port 587
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
  // Strip any existing sign-offs with wrong names (Ethan, etc.)
  let cleaned = body;
  cleaned = cleaned.replace(/\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care),?\s*\n\s*(Ethan|Ethan Hale|Nicolas|Nick)\b[\s\S]{0,200}$/i, '');
  cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*\n.*Relay\s*Solutions[\s\S]{0,200}$/i, '');
  cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*\n/gi, '\n');
  cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*$/i, '');
  cleaned = cleaned.trimEnd();
  
  return `${cleaned}

${SENDER_NAME}
Relay — AI & Automation Systems
${SENDER_PHONE}
${SENDER_EMAIL}
www.relaysolutions.net

P.S. If this isn't relevant, just reply and let me know — happy to remove you from my list.`;
}

// ─── Fetch Template for Fallback ──────────────────────────────────────────────
async function getCampaignTemplate(campaignId) {
  const { data } = await supabase
    .from('scheduled_emails')
    .select('id, templates(subject, content)')
    .eq('campaign_id', campaignId)
    .limit(1)
    .maybeSingle();
  if (data && data.templates) {
    return { subject: data.templates.subject, content: data.templates.content, scheduleId: data.id };
  }
  return null;
}

function applyTemplate(templateStr, lead, isSubject = false) {
  if (!templateStr) return '';
  let res = templateStr;
  const name = (lead.name || '').trim();
  const company = (lead.company || '').trim() || 'your company';
  
  // Smart first name: use actual name, fall back to company name, NEVER use "there"
  let firstName = '';
  const businessKeywords = ['ltd', 'limited', 'llc', 'inc', 'agency', 'digital', 'marketing', 'consulting', 'solutions', 'services', 'group', 'partners', 'associates', 'studio', 'entertainment', 'warehouse', 'management', 'technologies', 'designs', 'property', 'properties', 'lettings', 'letting', 'estate', 'agents', 'agent', 'agency', 'co.uk', 'real estate', 'clinic', 'dental', 'medical', 'events', 'design', 'homes', 'co', 'and', '&'];
  if (name) {
    const isLikelyCompany = name.length > 30 || businessKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(name)) || name.includes('&');
    if (!isLikelyCompany) {
      firstName = name.split(' ')[0];
      // Make sure it's actually a person's name, not a company name repeated
      const lowerFirst = firstName.toLowerCase();
      if (lowerFirst === 'the' || lowerFirst === 'a' || lowerFirst === 'an' || lowerFirst === 'unknown' ||
          lowerFirst === company.toLowerCase() || firstName.length <= 1) {
        firstName = '';
      }
    }
  }

  // Fallback to key person name from research if primary name is a company
  if (!firstName && lead.key_people) {
    try {
      const people = typeof lead.key_people === 'string' ? JSON.parse(lead.key_people) : lead.key_people;
      if (Array.isArray(people) && people.length > 0 && people[0].name) {
        const firstPersonName = people[0].name.trim();
        const firstPersonPart = firstPersonName.split(' ')[0];
        const isLikelyCompany = firstPersonName.length > 30 || businessKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(firstPersonName)) || firstPersonName.includes('&');
        if (!isLikelyCompany && firstPersonPart.length > 2) {
          firstName = firstPersonPart;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  // For subject lines: use first name if available, otherwise use company name
  // For body: use first name if available, otherwise use "Hi" with no name
  const nameForSubject = firstName || company;
  const nameForBody = firstName || 'Hi';
  const displayName = isSubject ? nameForSubject : nameForBody;
  
  res = res.replace(/\{\{first_name\}\}|\{first_name\}|\{firstName\}|\[First Name\]/gi, displayName);
  res = res.replace(/\{\{name\}\}|\{name\}|\[Name\]/gi, name || displayName);
  res = res.replace(/\{\{company\}\}|\{company\}|\{companyName\}|\[Company\]|\{\{org_name\}\}/gi, company);
  res = res.replace(/\{\{industry\}\}|\{industry\}/gi, lead.industry || 'industry');
  res = res.replace(/\{\{location\}\}|\{location\}/gi, lead.location || '');
  res = res.replace(/\{\{sender_name\}\}|\{sender_name\}|\[Sender Name\]/gi, SENDER_NAME);
  res = res.replace(/\{\{sender_email\}\}|\{sender_email\}/gi, SENDER_EMAIL);
  res = res.replace(/\{\{sender_phone\}\}|\{sender_phone\}/gi, SENDER_PHONE);
  res = res.replace(/\{\{sender_company\}\}|\{sender_company\}|<company>/gi, 'Relay Solutions');
  res = res.replace(/\{\{ender\}\}|\{ender\}/gi, 'Best,');
  // Strip any remaining unresolved placeholders
  res = res.replace(/\{\{[^}]+\}\}/g, '');
  
  // Clean up body: replace "Hi," or "Hi " at start if name was used as "Hi"
  if (!firstName && !isSubject) {
    // If the template starts with "{{first_name}}," it becomes "Hi," — clean it
    res = res.replace(/^Hi,\s*\n\n/i, 'Hi,\n\n');
  }
  
  return res;
}

// ─── Fetch pending batch for a campaign ──────────────────────────────────────
async function fetchPendingBatch(campaignId) {
  const { data, error } = await supabase
    .from('campaign_leads')
    .select('lead_id, leads!inner(id, email, name, company, personalized_email, personalized_subject, industry, location, key_people)')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(BATCH_SIZE);

  if (error) { log(`❌ Fetch error: ${error.message}`); return []; }
  
  const templateObj = await getCampaignTemplate(campaignId);

  return (data || []).filter(cl => {
    const l = cl.leads;
    if (!l?.email?.trim()) return false;
    
    // If missing personalized content, wait for the AI campaign processor to generate it
    if (!l.personalized_email?.trim() || !l.personalized_subject?.trim()) {
      return false;
    }
    
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
    .select('lead_id, leads!inner(id, email, personalized_email, key_people)')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(200);

  if (!data) return 0;
  
  const templateObj = await getCampaignTemplate(campaignId);
  
  let skipped = 0;
  for (const cl of data) {
    const l = cl.leads;
    const bad = !l?.email?.trim() ||
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

        const emailAccountId = 'a150822b-e79c-4128-a32f-52aa3ef4e5ff';
        const { data: schedData } = await supabase
          .from('scheduled_emails')
          .select('id')
          .eq('campaign_id', campaign.id)
          .limit(1)
          .maybeSingle();
        const scheduleId = schedData?.id;

        if (scheduleId) {
          await supabase.from('campaign_progress').upsert({
            campaign_id: campaign.id,
            schedule_id: scheduleId,
            lead_id: lead.id,
            email_account_id: emailAccountId,
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'campaign_id,schedule_id,lead_id' });

          const { data: currentStats } = await supabase
            .from('scheduled_emails').select('sent_emails').eq('id', scheduleId).single();
          if (currentStats) {
            await supabase.from('scheduled_emails')
              .update({ sent_emails: (currentStats.sent_emails || 0) + 1 }).eq('id', scheduleId);
          }
        }

        await supabase.from('inbox_emails').insert({
          email_account_id: emailAccountId,
          folder: 'sent',
          uid: Math.floor(Math.random() * 1000000000),
          from: SENDER_EMAIL,
          to: lead.email,
          subject: lead.personalized_subject,
          body_text: lead.personalized_email,
          body_html: lead.personalized_email.replace(/\n/g, '<br/>'),
          snippet: lead.personalized_email.substring(0, 100),
          received_at: new Date().toISOString(),
          is_read: true,
          campaign_id: campaign.id
        });

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
  log('  UNIVERSAL CAMPAIGN SENDER — CONTINUOUS MODE');
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
    catch (e) { log(`❌ SMTP still failing: ${e.message}. Retrying again next loop.`); }
  }

  // Run continuously
  while (true) {
    try {
      // Get all active/in_progress campaigns
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, niche, status')
        .in('status', ['active', 'in_progress'])
        .order('name');

      if (error || !campaigns) {
        log(`❌ Campaign fetch failed: ${error?.message}. Retrying in 60s...`);
        await sleep(60000);
        continue;
      }

      log(`\n📋 Active campaigns: ${campaigns.length}`);
      for (const c of campaigns) log(`  • ${c.name}`);

      let totalSent = 0, totalFailed = 0;

      for (const campaign of campaigns) {
        const { sent, failed } = await processCampaign(campaign);
        totalSent += sent;
        totalFailed += failed;
      }

      log('\n═══════════════════════════════════════════════════════════════');
      log('  CYCLE COMPLETE');
      log('═══════════════════════════════════════════════════════════════');
      log(`  ✅ Total sent:   ${totalSent}`);
      log(`  ❌ Total failed: ${totalFailed}`);
      log('  ⏳ Sleeping 5 minutes before next cycle...');
      log('═══════════════════════════════════════════════════════════════');

      await sleep(5 * 60 * 1000); // 5 minute pause between full cycles
    } catch (err) {
      log(`💀 Cycle error: ${err.message}. Retrying in 60s...`);
      await sleep(60000);
    }
  }
}

main().catch(err => { log(`🚨 FATAL: ${err.message}`); console.error(err); });
