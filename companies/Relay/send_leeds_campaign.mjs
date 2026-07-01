import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ─── Configuration ───────────────────────────────────────────────────────────
const CAMPAIGN_ID = 'a750722b-e79c-4128-a32f-52aa3ef4e5ff';
const SENDER_EMAIL = 'nicolas@relaysolutions.net';
const SENDER_NAME = 'Nicolas';
const SENDER_PHONE = '+44 7864 851184';
const MIN_DELAY_SEC = 45;
const MAX_DELAY_SEC = 90;
const DRY_RUN = false; // Set to true to preview emails without sending

// Personal email domains to exclude (GDPR compliance)
const PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com', 'live.co.uk', 'btinternet.com', 'sky.com'];

// ─── Log file ────────────────────────────────────────────────────────────────
const LOG_FILE = path.resolve(__dirname, `leeds_campaign_log_${new Date().toISOString().slice(0, 10)}.txt`);

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

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

// ─── Supabase Client ─────────────────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractFirstName(fullName) {
  if (!fullName || fullName.trim() === '') return null;
  // Handle "FirstName MiddleName LASTNAME" format — names in ALL CAPS are last names
  const parts = fullName.trim().split(/\s+/);
  // Return first non-uppercase part, or just the first part
  for (const part of parts) {
    if (part !== part.toUpperCase()) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
  }
  // All parts uppercase, just use first part
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function cleanCompanyName(company) {
  if (!company) return '';
  // Remove " - Leeds", " Ltd", trailing city names etc for cleaner display
  return company
    .replace(/\s*-\s*(Leeds|Property Management|Letting|Lettings|Estate Agents?).*$/i, '')
    .replace(/\s+Ltd\.?$/i, '')
    .replace(/\s+Limited$/i, '')
    .trim();
}

function cleanLocation(location) {
  if (!location) return 'the UK';
  // Extract city/area from address
  const cleaned = location.replace(/^[\s\\n]+/, '').trim();
  // Try to extract the town/city (usually before the postcode)
  const parts = cleaned.split(',').map(p => p.trim());
  // Find the part that looks like a city (not a street number, not a postcode)
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    if (part && !part.match(/^\d/) && !part.match(/^[A-Z]{1,2}\d/) && part !== 'United Kingdom') {
      return part;
    }
  }
  return parts[0] || 'the UK';
}

function randomDelay() {
  const seconds = Math.floor(Math.random() * (MAX_DELAY_SEC - MIN_DELAY_SEC + 1)) + MIN_DELAY_SEC;
  return seconds * 1000;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Email Variations ────────────────────────────────────────────────────────
// Multiple templates to avoid pattern detection by spam filters
const emailTemplates = [
  // Template 1 — Pain point: manual tenant management
  (firstName, companyName, location) => ({
    subject: `Quick one for ${companyName}`,
    body: `Hi ${firstName},

Noticed you're running ${companyName} in ${location} — most property management firms I speak to are losing hours a week to manual scheduling, tenant follow-ups, or chasing maintenance requests.

I run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.

Worth a 10 minute call this week?`
  }),

  // Template 2 — Pain point: chasing rent/payments
  (firstName, companyName, location) => ({
    subject: `${firstName} — property admin question`,
    body: `Hi ${firstName},

Running a property management operation in ${location} usually means chasing rent arrears, fielding maintenance calls, and juggling tenant comms manually.

We build lightweight automation for firms like ${companyName} — things like automated rent reminders, maintenance tracking, and tenant onboarding that run in the background.

Happy to do a quick free audit if you're curious — just reply to this email.`
  }),

  // Template 3 — Pain point: scaling without more headcount
  (firstName, companyName, location) => ({
    subject: `Scaling ${companyName} without hiring`,
    body: `Hi ${firstName},

Most property managers I talk to in ${location} hit the same ceiling — more properties means more admin, and hiring to keep up eats into margins.

At Relay we build custom systems that handle the repetitive stuff (tenant comms, scheduling, payment tracking) so you can take on more without adding headcount.

If you're interested, I'll do a free 10-minute audit. Just reply here.`
  }),

  // Template 4 — Pain point: tenant communication overhead
  (firstName, companyName, location) => ({
    subject: `${firstName}, quick question about ${companyName}`,
    body: `Hi ${firstName},

Curious — how much time does your team at ${companyName} spend fielding tenant queries and maintenance requests each week?

Most property firms in ${location} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.

I'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.`
  }),

  // Template 5 — Pain point: outdated systems
  (firstName, companyName, location) => ({
    subject: `${companyName} — quick thought`,
    body: `Hi ${firstName},

A lot of property management firms in ${location} are still running on spreadsheets and manual emails for tenant comms, rent chasing, and maintenance logs.

At Relay we build simple automation that replaces that admin overhead — custom-built for how ${companyName} actually works.

Worth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.`
  }),

  // Template 6 — Direct and brief
  (firstName, companyName, location) => ({
    subject: `For ${firstName} at ${companyName}`,
    body: `Hi ${firstName},

I work with property management firms around ${location} — most are burning hours on admin that could easily be automated (rent reminders, maintenance workflows, tenant onboarding).

I'd like to offer ${companyName} a free, no-obligation audit to see where you could save time.

Interested? Just reply and we'll find 10 minutes.`
  }),
];

function generateEmail(lead) {
  const firstName = extractFirstName(lead.name) || cleanCompanyName(lead.company).split(' ')[0] || 'there';
  const companyName = cleanCompanyName(lead.company) || 'your firm';
  const location = cleanLocation(lead.location);

  // Deterministic template selection based on lead ID to ensure consistency
  const hash = lead.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const templateIndex = hash % emailTemplates.length;
  const template = emailTemplates[templateIndex];

  const { subject, body } = template(firstName, companyName, location);

  const fullBody = `${body}

${SENDER_NAME}
Relay — AI & Automation Systems
${SENDER_PHONE}
${SENDER_EMAIL}
www.relaysolutions.net

---
Relay Solutions Ltd · relaysolutions.net
You're receiving this because we believe our automation systems are relevant to your business operations.
To unsubscribe, reply with "unsubscribe" in the subject line.`;

  return { subject, body: fullBody };
}

// ─── Main Send Loop ──────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════════════');
  log('  LEEDS PROPERTY MANAGEMENT CAMPAIGN — MANUAL SEND');
  log(`  Campaign ID: ${CAMPAIGN_ID}`);
  log(`  Sender: ${SENDER_EMAIL}`);
  log(`  Dry Run: ${DRY_RUN}`);
  log('═══════════════════════════════════════════════════════════════');

  // Verify SMTP connection
  try {
    await transporter.verify();
    log('✅ SMTP connection verified successfully');
  } catch (err) {
    log(`❌ SMTP connection FAILED: ${err.message}`);
    log('Aborting campaign. Fix SMTP credentials and try again.');
    process.exit(1);
  }

  // Fetch all leads for this campaign with valid business emails
  log('Fetching leads from database...');
  const { data: leads, error } = await supabase
    .from('campaign_leads')
    .select(`
      lead_id,
      status,
      leads!inner (
        id, email, name, company, title, location, website, personalized_email, personalized_subject
      )
    `)
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'pending');

  if (error) {
    log(`❌ Database query failed: ${error.message}`);
    process.exit(1);
  }

  // Filter to valid business emails only
  const validLeads = leads.filter(cl => {
    const lead = cl.leads;
    if (!lead || !lead.email || lead.email.trim() === '') return false;
    const domain = lead.email.split('@')[1]?.toLowerCase();
    if (PERSONAL_DOMAINS.includes(domain)) return false;
    return true;
  });

  log(`📊 Total campaign leads: ${leads.length}`);
  log(`📊 Valid business email leads: ${validLeads.length}`);
  log(`📊 Skipped (no email or personal domain): ${leads.length - validLeads.length}`);
  log('');

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < validLeads.length; i++) {
    const cl = validLeads[i];
    const lead = cl.leads;
    const progress = `[${i + 1}/${validLeads.length}]`;

    try {
      // Generate personalized email
      const { subject, body } = generateEmail(lead);

      log(`${progress} Sending to: ${lead.email} (${lead.company})`);
      log(`  Subject: ${subject}`);

      if (DRY_RUN) {
        log(`  🔸 DRY RUN — would send to ${lead.email}`);
        skipped++;
      } else {
        // Send email
        const info = await transporter.sendMail({
          from: `"Nicolas — Relay Solutions" <${SENDER_EMAIL}>`,
          to: lead.email,
          subject: subject,
          text: body,
          headers: {
            'X-Mailer': 'Relay Campaign Engine',
            'List-Unsubscribe': `<mailto:${SENDER_EMAIL}?subject=unsubscribe>`,
          }
        });

        log(`  ✅ SENT — Message ID: ${info.messageId}`);
        sent++;

        // Update campaign_leads status
        await supabase
          .from('campaign_leads')
          .update({ status: 'sent', last_sent_at: new Date().toISOString() })
          .eq('campaign_id', CAMPAIGN_ID)
          .eq('lead_id', lead.id);

        // Update lead's personalized fields for record keeping
        await supabase
          .from('leads')
          .update({
            personalized_subject: subject,
            personalized_email: body.split('\n\n' + SENDER_NAME)[0], // Store just the body without signature
            status: 'contacted'
          })
          .eq('id', lead.id);
      }
    } catch (err) {
      log(`  ❌ FAILED — ${lead.email}: ${err.message}`);
      failed++;

      // Update status to failed
      try {
        await supabase
          .from('campaign_leads')
          .update({ status: 'failed' })
          .eq('campaign_id', CAMPAIGN_ID)
          .eq('lead_id', lead.id);
      } catch (dbErr) {
        log(`  ⚠️  Could not update DB status: ${dbErr.message}`);
      }
    }

    // Random delay between emails (skip delay after last email)
    if (i < validLeads.length - 1 && !DRY_RUN) {
      const delayMs = randomDelay();
      const delaySec = Math.round(delayMs / 1000);
      log(`  ⏳ Waiting ${delaySec}s before next email...`);
      await sleep(delayMs);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  CAMPAIGN COMPLETE');
  log('═══════════════════════════════════════════════════════════════');
  log(`  ✅ Sent:    ${sent}`);
  log(`  ❌ Failed:  ${failed}`);
  log(`  🔸 Skipped: ${skipped}`);
  log(`  📊 Total:   ${validLeads.length}`);
  log(`  📄 Log:     ${LOG_FILE}`);
  log('═══════════════════════════════════════════════════════════════');

  // Close transporter
  transporter.close();
}

main().catch(err => {
  log(`💀 FATAL ERROR: ${err.message}`);
  console.error(err);
  process.exit(1);
});
