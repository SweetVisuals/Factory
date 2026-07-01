/**
 * Universal Campaign Email Drafter
 * 
 * Drafts personalized emails for ALL active campaigns that have undrafted leads.
 * Each campaign niche gets its own set of 6 template variations.
 * 
 * Run: node draft_all_campaigns.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com',
  'live.co.uk', 'btinternet.com', 'sky.com', 'googlemail.com', 'nhs.net',
  'macmillan.org.uk'
];

// ─── Shared Helpers ──────────────────────────────────────────────────────────

function extractFirstName(fullName) {
  if (!fullName || fullName.trim() === '') return null;
  // Handle "Dr" prefix and "AL-HAJ, Dalia, Dr" format
  const cleaned = fullName.replace(/,?\s*Dr\.?$/i, '').replace(/^Dr\.?\s*/i, '').trim();
  if (!cleaned) return null;
  // Handle "LASTNAME, Firstname" format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(p => p.trim());
    if (parts[1]) {
      const firstName = parts[1].split(/\s+/)[0];
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
  }
  const parts = cleaned.trim().split(/\s+/);
  for (const part of parts) {
    if (part !== part.toUpperCase() && part.length > 1) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
  }
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function cleanCompanyName(company) {
  if (!company) return '';
  return company
    .replace(/\s*[-–—]\s*(?:Leeds|London|Glasgow|Edinburgh|Birmingham|Manchester|Liverpool|Bristol|Sheffield|Nottingham|Cardiff|Belfast|Coventry|Aylsham|Yeovil|Shrewsbury|Caernarfon|Somerset|Property Management|Letting|Lettings|Sales\s*(?:&|and)\s*Lettings?|Residential|SALES ONLY).*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+(?:Ltd|Limited|PLC|LLP)\.?\s*$/i, '')
    .replace(/\s+(?:Sales\s*(?:&|and)\s*Lettings?)\s*$/i, '')
    .replace(/\s+(?:Formerly\s+.*)$/i, '')
    .trim();
}

function cleanLocation(location) {
  if (!location) return 'the UK';
  const cleaned = location.replace(/^[\s\\n]+/, '').trim();
  if (!cleaned) return 'the UK';
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (part === 'United Kingdom' || part === 'UK') continue;
    if (/^[A-Z]{1,2}\d/i.test(part)) continue;
    const cityPostcode = part.match(/^([A-Za-z\s\-'.]+?)\s+[A-Z]{1,2}\d/);
    if (cityPostcode) return cityPostcode[1].trim();
    if (/^\d/.test(part)) continue;
    if (/^(Head Office|Suite|Unit|Floor|House|Building|Centre|Business|Park|Ground|c\/o|WeWork)/i.test(part)) continue;
    return part;
  }
  return parts[0] || 'the UK';
}

function shortName(company) {
  if (company.length <= 35) return company;
  const truncated = company.substring(0, 35).replace(/\s+\S*$/, '');
  return truncated || company.substring(0, 35);
}

function getGreeting(lead) {
  return extractFirstName(lead.name) || 'there';
}

// ─── Niche-Specific Templates ────────────────────────────────────────────────

// ── ACCOUNTING FIRMS ─────────────────────────────────────────────────────────
const accountingTemplates = [
  (g, cn, sn, loc, hn) => ({
    subject: `Quick one for ${sn}`,
    body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most accountancy practices I speak to are losing hours a week to manual data entry, client chasing, and report formatting.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g} — quick accounting question` : `${sn} — quick question`,
    body: `Hi ${g},\n\nRunning an accounting practice in ${loc} usually means chasing clients for documents, manually reconciling entries, and formatting reports at month-end.\n\nWe build lightweight automation for firms like ${cn} — things like automated client reminders, document collection workflows, and report generation that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `Scaling ${sn} without hiring`,
    body: `Hi ${g},\n\nMost accountants I talk to in ${loc} hit the same ceiling — more clients means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (client onboarding, document chasing, deadline tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`,
    body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend chasing clients for missing documents and receipts each month?\n\nMost accounting firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `${sn} — quick thought`,
    body: `Hi ${g},\n\nA lot of accounting practices in ${loc} are still running on spreadsheets and manual emails for client reminders, document collection, and deadline tracking.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`,
    body: `Hi ${g},\n\nI work with accounting firms around ${loc} — most are burning hours on admin that could easily be automated (client reminders, document workflows, deadline tracking).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.`
  }),
];

// ── DENTAL PRACTICES ─────────────────────────────────────────────────────────
const dentalTemplates = [
  (g, cn, sn, loc, hn) => ({
    subject: `Quick one for ${sn}`,
    body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most dental practices I speak to are losing hours a week to appointment no-shows, manual patient reminders, and booking admin.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g} — practice admin question` : `${sn} — practice admin question`,
    body: `Hi ${g},\n\nRunning a dental practice in ${loc} usually means chasing patients for appointments, fielding booking calls, and managing recall lists manually.\n\nWe build lightweight automation for practices like ${cn} — things like automated appointment reminders, recall workflows, and patient onboarding that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `Scaling ${sn} without hiring`,
    body: `Hi ${g},\n\nMost dental practices I talk to in ${loc} hit the same ceiling — more patients means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (appointment reminders, patient comms, recall tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`,
    body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend on appointment confirmations, no-show follow-ups, and recall reminders each week?\n\nMost dental practices in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `${sn} — quick thought`,
    body: `Hi ${g},\n\nA lot of dental practices in ${loc} are still running on phone calls and manual emails for appointment reminders, patient recalls, and booking confirmations.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`,
    body: `Hi ${g},\n\nI work with dental practices around ${loc} — most are burning hours on admin that could easily be automated (appointment reminders, recall workflows, patient onboarding).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.`
  }),
];

// ── LAW FIRMS ────────────────────────────────────────────────────────────────
const legalTemplates = [
  (g, cn, sn, loc, hn) => ({
    subject: `Quick one for ${sn}`,
    body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most law firms I speak to are losing hours a week to manual client intake, document chasing, and case file admin.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g} — legal admin question` : `${sn} — legal admin question`,
    body: `Hi ${g},\n\nRunning a law firm in ${loc} usually means chasing clients for documents, manually logging case updates, and juggling intake forms across systems.\n\nWe build lightweight automation for firms like ${cn} — things like automated client intake, document collection workflows, and deadline reminders that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `Scaling ${sn} without hiring`,
    body: `Hi ${g},\n\nMost law firms I talk to in ${loc} hit the same ceiling — more clients means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (client intake, document chasing, deadline tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`,
    body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend chasing clients for documents, logging case updates, and managing intake forms each week?\n\nMost law firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `${sn} — quick thought`,
    body: `Hi ${g},\n\nA lot of law firms in ${loc} are still running on manual emails and spreadsheets for client intake, document tracking, and deadline management.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`,
    body: `Hi ${g},\n\nI work with law firms around ${loc} — most are burning hours on admin that could easily be automated (client intake, document workflows, deadline tracking).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.`
  }),
];

// ── PROPERTY MANAGEMENT (already done, included for completeness) ────────────
const propertyTemplates = [
  (g, cn, sn, loc, hn) => ({
    subject: `Quick one for ${sn}`,
    body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most property management firms I speak to are losing hours a week to manual scheduling, tenant follow-ups, or chasing maintenance requests.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g} — property admin question` : `${sn} — property admin question`,
    body: `Hi ${g},\n\nRunning a property management operation in ${loc} usually means chasing rent arrears, fielding maintenance calls, and juggling tenant comms manually.\n\nWe build lightweight automation for firms like ${cn} — things like automated rent reminders, maintenance tracking, and tenant onboarding that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `Scaling ${sn} without hiring`,
    body: `Hi ${g},\n\nMost property managers I talk to in ${loc} hit the same ceiling — more properties means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (tenant comms, scheduling, payment tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`,
    body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend fielding tenant queries and maintenance requests each week?\n\nMost property firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: `${sn} — quick thought`,
    body: `Hi ${g},\n\nA lot of property management firms in ${loc} are still running on spreadsheets and manual emails for tenant comms, rent chasing, and maintenance logs.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.`
  }),
  (g, cn, sn, loc, hn) => ({
    subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`,
    body: `Hi ${g},\n\nI work with property management firms around ${loc} — most are burning hours on admin that could easily be automated (rent reminders, maintenance workflows, tenant onboarding).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.`
  }),
];

// ─── Niche → Template Map ────────────────────────────────────────────────────
const NICHE_TEMPLATES = {
  'Accounting Firms in Birmingham': accountingTemplates,
  'Dental/Healthcare': dentalTemplates,
  'Legal Services': legalTemplates,
  'Property Management': propertyTemplates,
};

// Fallback — generic templates if niche not matched
const genericTemplates = accountingTemplates; // Reasonable generic fallback

function getTemplates(niche) {
  return NICHE_TEMPLATES[niche] || genericTemplates;
}

// ─── Generate email for a lead in a given niche ──────────────────────────────
function generateEmail(lead, niche) {
  const greeting = getGreeting(lead);
  const companyName = cleanCompanyName(lead.company) || 'your firm';
  const sn = shortName(companyName);
  const location = cleanLocation(lead.location);
  const hasName = greeting !== 'there';
  const templates = getTemplates(niche);

  const hash = lead.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const templateIndex = hash % templates.length;

  return templates[templateIndex](greeting, companyName, sn, location, hasName);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  UNIVERSAL CAMPAIGN DRAFTER — ALL ACTIVE CAMPAIGNS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get all active campaigns
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id, name, niche, status')
    .eq('status', 'active')
    .order('name');

  if (campErr) { console.error('❌ Campaign fetch error:', campErr.message); process.exit(1); }

  console.log(`Found ${campaigns.length} active campaigns:\n`);
  for (const c of campaigns) {
    console.log(`  • ${c.name} (${c.niche})`);
  }
  console.log('');

  let grandTotal = 0;
  let grandDrafted = 0;
  let grandErrors = 0;

  for (const campaign of campaigns) {
    console.log(`\n───────────────────────────────────────────────────────────────`);
    console.log(`  CAMPAIGN: ${campaign.name}`);
    console.log(`  Niche: ${campaign.niche}`);
    console.log(`───────────────────────────────────────────────────────────────`);

    // Fetch ALL leads with pagination
    let allLeads = [];
    let offset = 0;
    const PAGE = 1000;

    while (true) {
      const { data: rows, error } = await supabase
        .from('campaign_leads')
        .select('lead_id, leads!inner(id, email, name, company, location, website, personalized_email)')
        .eq('campaign_id', campaign.id)
        .range(offset, offset + PAGE - 1);

      if (error) { console.error(`  ❌ Fetch error: ${error.message}`); break; }
      if (!rows || rows.length === 0) break;
      allLeads = allLeads.concat(rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }

    // Filter to valid business emails that need drafting
    const toDraft = allLeads.filter(cl => {
      const lead = cl.leads;
      if (!lead?.email || lead.email.trim() === '') return false;
      const domain = lead.email.split('@')[1]?.toLowerCase();
      if (!domain || !domain.includes('.')) return false;
      if (PERSONAL_DOMAINS.includes(domain)) return false;
      if (lead.personalized_email && lead.personalized_email.trim() !== '') return false;
      return true;
    });

    const alreadyDone = allLeads.filter(cl => cl.leads?.personalized_email?.trim());

    console.log(`  Total leads: ${allLeads.length}`);
    console.log(`  Already drafted: ${alreadyDone.length}`);
    console.log(`  Need drafting: ${toDraft.length}`);

    if (toDraft.length === 0) {
      console.log(`  ✅ All done for this campaign.\n`);
      continue;
    }

    // Batch draft
    let drafted = 0;
    let errors = 0;
    const BATCH_SIZE = 50;

    for (let batch = 0; batch < toDraft.length; batch += BATCH_SIZE) {
      const chunk = toDraft.slice(batch, batch + BATCH_SIZE);
      const updates = [];

      for (const cl of chunk) {
        const lead = cl.leads;
        try {
          const { subject, body } = generateEmail(lead, campaign.niche);
          updates.push({ id: lead.id, personalized_subject: subject, personalized_email: body });
          drafted++;
        } catch (err) {
          console.error(`  ❌ ${lead.company}: ${err.message}`);
          errors++;
        }
      }

      if (updates.length > 0) {
        const { error: upsertErr } = await supabase
          .from('leads')
          .upsert(updates, { onConflict: 'id', ignoreDuplicates: false });

        if (upsertErr) {
          console.error(`  ❌ Batch upsert error: ${upsertErr.message}`);
          errors += updates.length; drafted -= updates.length;
        } else {
          const batchEnd = Math.min(batch + BATCH_SIZE, toDraft.length);
          console.log(`  ✅ Batch ${Math.floor(batch / BATCH_SIZE) + 1}: leads ${batch + 1}–${batchEnd}`);
        }
      }
    }

    console.log(`  📊 Drafted: ${drafted} | Errors: ${errors}`);
    grandTotal += toDraft.length;
    grandDrafted += drafted;
    grandErrors += errors;

    // Preview 2 emails from this campaign
    console.log(`\n  ─── PREVIEW ───`);
    for (let i = 0; i < Math.min(2, toDraft.length); i++) {
      const lead = toDraft[i].leads;
      const { subject, body } = generateEmail(lead, campaign.niche);
      console.log(`  TO: ${lead.email} (${lead.company})`);
      console.log(`  SUBJECT: ${subject}`);
      console.log(`  BODY: ${body.substring(0, 150)}...`);
      console.log('');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ALL CAMPAIGNS DRAFTED');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Total drafted: ${grandDrafted}`);
  console.log(`  ❌ Total errors:  ${grandErrors}`);
  console.log(`  📊 Grand total:   ${grandTotal}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('💀 FATAL:', err); process.exit(1); });
