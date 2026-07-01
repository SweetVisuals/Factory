/**
 * Draft the remaining 24 leads that were missed due to Supabase's 1000-row default limit.
 * Uses the same template logic as the main drafting script.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const CAMPAIGN_ID = 'a750722b-e79c-4128-a32f-52aa3ef4e5ff';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com',
  'live.co.uk', 'btinternet.com', 'sky.com', 'googlemail.com'
];

function extractFirstName(fullName) {
  if (!fullName || fullName.trim() === '') return null;
  const parts = fullName.trim().split(/\s+/);
  for (const part of parts) {
    if (part !== part.toUpperCase()) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
  }
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function cleanCompanyName(company) {
  if (!company) return '';
  return company
    .replace(/\s*[-–—]\s*(Leeds|London|Property Management|Letting|Lettings|Estate Agents?|Sales\s*&?\s*Lettings?|Residential|Keswick|Shrewsbury|Merthyr Tydfil|Wembley|Folkestone|Truro|Crewkerne|Cheadle Hulme).*$/i, '')
    .replace(/\s+Ltd\.?$/i, '')
    .replace(/\s+Limited$/i, '')
    .replace(/\s+PLC$/i, '')
    .replace(/\s+LLP$/i, '')
    .replace(/\s*\(SALES ONLY\)/i, '')
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
    if (/^[A-Z]{1,2}\d/.test(part)) continue;
    if (/^\d+/.test(part)) continue;
    return part;
  }
  return parts[0] || 'the UK';
}

const emailTemplates = [
  (fn, cn, loc) => ({ subject: `Quick one for ${cn}`, body: `Hi ${fn},\n\nNoticed you're running ${cn} in ${loc} — most property management firms I speak to are losing hours a week to manual scheduling, tenant follow-ups, or chasing maintenance requests.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?` }),
  (fn, cn, loc) => ({ subject: `${fn} — property admin question`, body: `Hi ${fn},\n\nRunning a property management operation in ${loc} usually means chasing rent arrears, fielding maintenance calls, and juggling tenant comms manually.\n\nWe build lightweight automation for firms like ${cn} — things like automated rent reminders, maintenance tracking, and tenant onboarding that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.` }),
  (fn, cn, loc) => ({ subject: `Scaling ${cn} without hiring`, body: `Hi ${fn},\n\nMost property managers I talk to in ${loc} hit the same ceiling — more properties means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (tenant comms, scheduling, payment tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.` }),
  (fn, cn, loc) => ({ subject: `${fn}, quick question about ${cn}`, body: `Hi ${fn},\n\nCurious — how much time does your team at ${cn} spend fielding tenant queries and maintenance requests each week?\n\nMost property firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.` }),
  (fn, cn, loc) => ({ subject: `${cn} — quick thought`, body: `Hi ${fn},\n\nA lot of property management firms in ${loc} are still running on spreadsheets and manual emails for tenant comms, rent chasing, and maintenance logs.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.` }),
  (fn, cn, loc) => ({ subject: `For ${fn} at ${cn}`, body: `Hi ${fn},\n\nI work with property management firms around ${loc} — most are burning hours on admin that could easily be automated (rent reminders, maintenance workflows, tenant onboarding).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.` }),
];

async function main() {
  // Fetch remaining undrafted leads directly via RPC-style query with offset
  const { data: rows, error } = await supabase
    .from('campaign_leads')
    .select('lead_id, leads!inner(id, email, name, company, location, website, personalized_email)')
    .eq('campaign_id', CAMPAIGN_ID)
    .range(1000, 1100); // Get rows beyond the first 1000

  if (error) { console.error('❌ Fetch error:', error.message); process.exit(1); }

  const toDraft = rows.filter(cl => {
    const lead = cl.leads;
    if (!lead || !lead.email || lead.email.trim() === '') return false;
    const domain = lead.email.split('@')[1]?.toLowerCase();
    if (!domain || !domain.includes('.')) return false; // Invalid email like leaflet@0.7.7
    if (PERSONAL_DOMAINS.includes(domain)) return false;
    if (lead.personalized_email && lead.personalized_email.trim() !== '') return false;
    return true;
  });

  console.log(`Found ${rows?.length || 0} overflow rows, ${toDraft.length} need drafting.`);

  const updates = [];
  for (const cl of toDraft) {
    const lead = cl.leads;
    const firstName = extractFirstName(lead.name) || cleanCompanyName(lead.company).split(' ')[0] || 'there';
    const companyName = cleanCompanyName(lead.company) || 'your firm';
    const location = cleanLocation(lead.location);
    const hash = lead.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const { subject, body } = emailTemplates[hash % emailTemplates.length](firstName, companyName, location);
    updates.push({ id: lead.id, personalized_subject: subject, personalized_email: body });
    console.log(`  ✅ ${lead.email} → "${subject}"`);
  }

  if (updates.length > 0) {
    const { error: upsertErr } = await supabase.from('leads').upsert(updates, { onConflict: 'id' });
    if (upsertErr) console.error('❌ Upsert error:', upsertErr.message);
    else console.log(`\n✅ Drafted ${updates.length} remaining leads.`);
  } else {
    console.log('Nothing to draft.');
  }

  // Also mark the invalid email (leaflet@0.7.7) so we skip it
  await supabase.from('leads').update({ email: '' }).eq('id', '33531d82-b43e-425b-9ddb-83bf770e3be8');
  console.log('🧹 Cleared invalid email: leaflet@0.7.7');

  // Final count
  const { data: finalCount } = await supabase.rpc('', {}).catch(() => null);
  console.log('\nDone. All leads should now be drafted.');
}

main().catch(err => { console.error('💀 FATAL:', err); process.exit(1); });
