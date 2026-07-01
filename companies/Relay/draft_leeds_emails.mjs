/**
 * Fix and re-draft all personalized emails with improved cleaning:
 * 1. Strip postcodes from locations (just city names)
 * 2. Better company name truncation for subjects
 * 3. Better fallback for leads with no contact name
 * 4. Strip parentheticals from company names
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const CAMPAIGN_ID = 'a750722b-e79c-4128-a32f-52aa3ef4e5ff';
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com',
  'live.co.uk', 'btinternet.com', 'sky.com', 'googlemail.com'
];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Improved Helpers ────────────────────────────────────────────────────────

function extractFirstName(fullName) {
  if (!fullName || fullName.trim() === '') return null;
  const parts = fullName.trim().split(/\s+/);
  // First non-uppercase part is the first name
  for (const part of parts) {
    if (part !== part.toUpperCase()) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
  }
  // All parts uppercase — use first part title-cased
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function cleanCompanyName(company) {
  if (!company) return '';
  return company
    // Remove branch location suffixes like "Estate Agents Headingley, Leeds"
    .replace(/\s+Estate\s+(?:and\s+Lettings\s+)?Agents?\s+[\w\s,]+$/i, '')
    // Remove "- City" / "- Area" suffixes
    .replace(/\s*[-–—]\s*(?:Leeds|London|Glasgow|Edinburgh|Birmingham|Manchester|Liverpool|Bristol|Sheffield|Nottingham|Cardiff|Belfast|Property Management|Letting|Lettings|Sales\s*(?:&|and)\s*Lettings?|Residential|SALES ONLY).*$/i, '')
    // Remove parentheticals like (Hanwell / Ealing) or (SALES ONLY)
    .replace(/\s*\([^)]*\)\s*/g, '')
    // Remove corporate suffixes
    .replace(/\s+Ltd\.?$/i, '').replace(/\s+Limited$/i, '')
    .replace(/\s+PLC$/i, '').replace(/\s+LLP$/i, '')
    // Remove trailing "Sales & Lettings" / "Sales and Lettings"
    .replace(/\s+Sales\s*(?:&|and)\s*Lettings?\s*$/i, '')
    .replace(/\s+Letting\s*(?:&|and)\s*(?:Estate\s+)?(?:Management|Agency)\s*$/i, '')
    .trim();
}

function cleanLocation(location) {
  if (!location) return 'the UK';
  const cleaned = location.replace(/^[\s\\n]+/, '').trim();
  if (!cleaned) return 'the UK';
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);

  // Walk backwards to find a city name
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (part === 'United Kingdom' || part === 'UK') continue;
    // Skip postcodes like "LS6 2UE", "E8 2NS", "BS40 8XF"
    if (/^[A-Z]{1,2}\d/i.test(part)) continue;
    // Skip combined "City POSTCODE" — extract just the city
    const cityPostcode = part.match(/^([A-Za-z\s\-'.]+?)\s+[A-Z]{1,2}\d/);
    if (cityPostcode) {
      return cityPostcode[1].trim();
    }
    // Skip pure numbers or street addresses starting with numbers
    if (/^\d/.test(part)) continue;
    // Skip things like "Head Office" or "Centenary House"
    if (/^(Head Office|Suite|Unit|Floor|House|Building|Centre|Business|Park)/i.test(part)) continue;
    return part;
  }
  return parts[0] || 'the UK';
}

// Derive a friendly greeting name when no contact name exists
function getGreetingName(lead) {
  const firstName = extractFirstName(lead.name);
  if (firstName) return firstName;

  // No contact name — use "there" for a natural greeting
  return 'there';
}

// ─── Email Templates ─────────────────────────────────────────────────────────

const emailTemplates = [
  // Template 0 — Core pitch
  (greeting, companyName, shortName, location, hasName) => ({
    subject: `Quick one for ${shortName}`,
    body: `Hi ${greeting},

Noticed you're running ${companyName} in ${location} — most property management firms I speak to are losing hours a week to manual scheduling, tenant follow-ups, or chasing maintenance requests.

I run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.

Worth a 10 minute call this week?`
  }),

  // Template 1 — Rent / payments
  (greeting, companyName, shortName, location, hasName) => ({
    subject: hasName ? `${greeting} — property admin question` : `${shortName} — property admin question`,
    body: `Hi ${greeting},

Running a property management operation in ${location} usually means chasing rent arrears, fielding maintenance calls, and juggling tenant comms manually.

We build lightweight automation for firms like ${companyName} — things like automated rent reminders, maintenance tracking, and tenant onboarding that run in the background.

Happy to do a quick free audit if you're curious — just reply to this email.`
  }),

  // Template 2 — Scaling
  (greeting, companyName, shortName, location, hasName) => ({
    subject: `Scaling ${shortName} without hiring`,
    body: `Hi ${greeting},

Most property managers I talk to in ${location} hit the same ceiling — more properties means more admin, and hiring to keep up eats into margins.

At Relay we build custom systems that handle the repetitive stuff (tenant comms, scheduling, payment tracking) so you can take on more without adding headcount.

If you're interested, I'll do a free 10-minute audit. Just reply here.`
  }),

  // Template 3 — Question-based
  (greeting, companyName, shortName, location, hasName) => ({
    subject: hasName ? `${greeting}, quick question about ${shortName}` : `Quick question for ${shortName}`,
    body: `Hi ${greeting},

Curious — how much time does your team at ${companyName} spend fielding tenant queries and maintenance requests each week?

Most property firms in ${location} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.

I'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.`
  }),

  // Template 4 — Spreadsheets angle
  (greeting, companyName, shortName, location, hasName) => ({
    subject: `${shortName} — quick thought`,
    body: `Hi ${greeting},

A lot of property management firms in ${location} are still running on spreadsheets and manual emails for tenant comms, rent chasing, and maintenance logs.

At Relay we build simple automation that replaces that admin overhead — custom-built for how ${companyName} actually works.

Worth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.`
  }),

  // Template 5 — Direct
  (greeting, companyName, shortName, location, hasName) => ({
    subject: hasName ? `For ${greeting} at ${shortName}` : `Quick intro for ${shortName}`,
    body: `Hi ${greeting},

I work with property management firms around ${location} — most are burning hours on admin that could easily be automated (rent reminders, maintenance workflows, tenant onboarding).

I'd like to offer ${companyName} a free, no-obligation audit to see where you could save time.

Interested? Just reply and we'll find 10 minutes.`
  }),
];

function shortCompanyName(company) {
  // Truncate for subject lines — max ~35 chars
  if (company.length <= 35) return company;
  // Try to cut at a word boundary
  const truncated = company.substring(0, 35).replace(/\s+\S*$/, '');
  return truncated || company.substring(0, 35);
}

function generateEmail(lead) {
  const greeting = getGreetingName(lead);
  const companyName = cleanCompanyName(lead.company) || 'your firm';
  const shortName = shortCompanyName(companyName);
  const location = cleanLocation(lead.location);
  const hasName = greeting !== 'there';

  const hash = lead.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const templateIndex = hash % emailTemplates.length;

  return emailTemplates[templateIndex](greeting, companyName, shortName, location, hasName);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RE-DRAFTING ALL EMAILS WITH IMPROVED PERSONALIZATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Fetch ALL leads (handle pagination beyond 1000)
  let allLeads = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data: rows, error } = await supabase
      .from('campaign_leads')
      .select('lead_id, leads!inner(id, email, name, company, location, website)')
      .eq('campaign_id', CAMPAIGN_ID)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('❌ Fetch error:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) break;
    allLeads = allLeads.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`Total leads fetched: ${allLeads.length}`);

  // Filter to valid business emails
  const validLeads = allLeads.filter(cl => {
    const lead = cl.leads;
    if (!lead || !lead.email || lead.email.trim() === '') return false;
    const domain = lead.email.split('@')[1]?.toLowerCase();
    if (!domain || !domain.includes('.')) return false;
    if (PERSONAL_DOMAINS.includes(domain)) return false;
    return true;
  });

  console.log(`Valid business email leads: ${validLeads.length}\n`);

  // Generate and batch update ALL of them
  let drafted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let batch = 0; batch < validLeads.length; batch += BATCH_SIZE) {
    const chunk = validLeads.slice(batch, batch + BATCH_SIZE);
    const updates = [];

    for (const cl of chunk) {
      const lead = cl.leads;
      try {
        const { subject, body } = generateEmail(lead);
        updates.push({ id: lead.id, personalized_subject: subject, personalized_email: body });
        drafted++;
      } catch (err) {
        console.error(`  ❌ ${lead.company}: ${err.message}`);
        errors++;
      }
    }

    if (updates.length > 0) {
      const { error: upsertErr } = await supabase.from('leads').upsert(updates, { onConflict: 'id', ignoreDuplicates: false });
      if (upsertErr) {
        console.error(`  ❌ Batch upsert error: ${upsertErr.message}`);
        errors += updates.length; drafted -= updates.length;
      } else {
        console.log(`  ✅ Batch ${Math.floor(batch / BATCH_SIZE) + 1}: leads ${batch + 1}–${Math.min(batch + BATCH_SIZE, validLeads.length)}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Drafted: ${drafted}  |  ❌ Errors: ${errors}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Show previews — pick one from each template
  console.log('─── PREVIEWS (one per template) ───\n');
  const shown = new Set();
  for (const cl of validLeads) {
    const lead = cl.leads;
    const hash = lead.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const tIdx = hash % emailTemplates.length;
    if (shown.has(tIdx)) continue;
    shown.add(tIdx);

    const { subject, body } = generateEmail(lead);
    console.log(`[Template ${tIdx}] TO: ${lead.email} (${lead.company})`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}\n`);
    console.log('───────────────────────────────────────\n');
    if (shown.size >= 6) break;
  }
}

main().catch(err => { console.error('💀 FATAL:', err); process.exit(1); });
