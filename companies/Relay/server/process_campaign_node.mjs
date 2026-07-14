"use strict";
import { createClient as Ne } from "@supabase/supabase-js";
import De from "nodemailer";
const Te =
    process.env["DEEPSEEK_API_KEY"] || "sk-6733c8ac2b83402b8626e5e253824488",
  Pe = "https://api.deepseek.com",
  Ae =
    process.env["SUPABASE_URL"] || "https://fzcrjogrnujrfxafxbkh.supabase.co",
  Re = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || "",
  ue = [
    process.env["OPENROUTER_API_KEY"],
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
  ].filter(Boolean);
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.uk', 'aol.com', 'icloud.com', 'live.com',
  'live.co.uk', 'btinternet.com', 'sky.com', 'googlemail.com', 'nhs.net',
  'macmillan.org.uk'
];

function extractFirstName(fullName) {
  if (!fullName || fullName.trim() === '') return null;
  const cleaned = fullName.replace(/,?\s*Dr\.?$/i, '').replace(/^Dr\.?\s*/i, '').trim();
  if (!cleaned) return null;
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

const accountingTemplates = [
  (g, cn, sn, loc, hn) => ({ subject: `Quick one for ${sn}`, body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most accountancy practices I speak to are losing hours a week to manual data entry, client chasing, and report formatting.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g} — quick accounting question` : `${sn} — quick question`, body: `Hi ${g},\n\nRunning an accounting practice in ${loc} usually means chasing clients for documents, manually reconciling entries, and formatting reports at month-end.\n\nWe build lightweight automation for firms like ${cn} — things like automated client reminders, document collection workflows, and report generation that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Scaling ${sn} without hiring`, body: `Hi ${g},\n\nMost accountants I talk to in ${loc} hit the same ceiling — more clients means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (client onboarding, document chasing, deadline tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`, body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend chasing clients for missing documents and receipts each month?\n\nMost accounting firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `${sn} — quick thought`, body: `Hi ${g},\n\nA lot of accounting practices in ${loc} are still running on spreadsheets and manual emails for client reminders, document collection, and deadline tracking.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`, body: `Hi ${g},\n\nI work with accounting firms around ${loc} — most are burning hours on admin that could easily be automated (client reminders, document workflows, deadline tracking).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `Quick question for ${g}` : `Quick question regarding ${sn}`, body: `Hi ${g},\n\nI was looking at ${cn} and noticed you're based in ${loc}. Many accountancy firms we speak with are struggling with the sheer volume of manual data entry and client chasing.\n\nAt Relay, we build custom automation systems that do this heavy lifting for you. We can automate onboarding, report generation, and reminders.\n\nWould you be open to a 10-minute free audit to see how much time we could save you?` }),
  (g, cn, sn, loc, hn) => ({ subject: `Automating admin at ${sn}`, body: `Hi ${g},\n\nMost accountants in ${loc} tell us that client follow-ups and manual document collection are the biggest drains on their time.\n\nWe run Relay, and we specialize in building small, tailored automation systems for firms like ${cn} to handle exactly these tasks in the background.\n\nIf you're curious about how it works, I'd love to offer a free 10-minute audit. No obligation. Just reply if interested.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, ideas for ${sn}` : `Ideas for ${sn}`, body: `Hi ${g},\n\nGrowing an accounting practice in ${loc} shouldn't mean drowning in admin. Yet, manual data entry and report formatting still eat up hours every week.\n\nWe build custom automation for firms like ${cn} that run silently in the background, freeing up your team to focus on advisory work.\n\nI'm offering a free, quick audit to show you what's possible. Let me know if you have 10 minutes this week.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Less admin, more capacity for ${sn}`, body: `Hi ${g},\n\nI'm reaching out because we help accounting practices in ${loc} take on more clients without hiring more staff.\n\nAt Relay, we build lightweight systems that automate client reminders, document workflows, and month-end tasks. It's custom-built for how ${cn} operates.\n\nHappy to show you how during a free 10-minute audit. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Quick thought on ${cn}`, body: `Hi ${g},\n\nA lot of accountancy firms around ${loc} rely heavily on manual emails and spreadsheets for tracking deadlines and client docs.\n\nAt Relay, we replace that overhead with simple, tailored automation. It allows you to scale ${sn} smoothly.\n\nWorth a brief call to see if this fits? I'm happy to do a free audit.` })
];

const dentalTemplates = [
  (g, cn, sn, loc, hn) => ({ subject: `Quick one for ${sn}`, body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most dental practices I speak to are losing hours a week to appointment no-shows, manual patient reminders, and booking admin.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g} — practice admin question` : `${sn} — practice admin question`, body: `Hi ${g},\n\nRunning a dental practice in ${loc} usually means chasing patients for appointments, fielding booking calls, and managing recall lists manually.\n\nWe build lightweight automation for practices like ${cn} — things like automated appointment reminders, recall workflows, and patient onboarding that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Scaling ${sn} without hiring`, body: `Hi ${g},\n\nMost dental practices I talk to in ${loc} hit the same ceiling — more patients means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (appointment reminders, patient comms, recall tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`, body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend on appointment confirmations, no-show follow-ups, and recall reminders each week?\n\nMost dental practices in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `${sn} — quick thought`, body: `Hi ${g},\n\nA lot of dental practices in ${loc} are still running on phone calls and manual emails for appointment reminders, patient recalls, and booking confirmations.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`, body: `Hi ${g},\n\nI work with dental practices around ${loc} — most are burning hours on admin that could easily be automated (appointment reminders, recall workflows, patient onboarding).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `Quick question for ${g}` : `Quick question regarding ${sn}`, body: `Hi ${g},\n\nI was looking at ${cn} and noticed you're based in ${loc}. Many dental practices we speak with struggle with no-shows and manual patient follow-ups.\n\nAt Relay, we build custom automation systems that do this heavy lifting for you. We can automate appointment reminders, patient onboarding, and recall tracking.\n\nWould you be open to a 10-minute free audit to see how much time we could save you?` }),
  (g, cn, sn, loc, hn) => ({ subject: `Automating admin at ${sn}`, body: `Hi ${g},\n\nMost practice managers in ${loc} tell us that booking admin and recall lists are the biggest drains on their time.\n\nWe run Relay, and we specialize in building small, tailored automation systems for practices like ${cn} to handle exactly these tasks in the background.\n\nIf you're curious about how it works, I'd love to offer a free 10-minute audit. No obligation. Just reply if interested.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, ideas for ${sn}` : `Ideas for ${sn}`, body: `Hi ${g},\n\nGrowing a dental practice in ${loc} shouldn't mean drowning in admin. Yet, managing bookings and patient comms still eat up hours every week.\n\nWe build custom automation for practices like ${cn} that run silently in the background, freeing up your front desk.\n\nI'm offering a free, quick audit to show you what's possible. Let me know if you have 10 minutes this week.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Less admin, more capacity for ${sn}`, body: `Hi ${g},\n\nI'm reaching out because we help dental practices in ${loc} take on more patients without hiring more front-desk staff.\n\nAt Relay, we build lightweight systems that automate patient reminders, recall workflows, and confirmations. It's custom-built for how ${cn} operates.\n\nHappy to show you how during a free 10-minute audit. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Quick thought on ${cn}`, body: `Hi ${g},\n\nA lot of dental practices around ${loc} rely heavily on phone calls and manual texts for appointment reminders.\n\nAt Relay, we replace that overhead with simple, tailored automation. It allows you to scale ${sn} smoothly and reduce no-shows.\n\nWorth a brief call to see if this fits? I'm happy to do a free audit.` })
];

const legalTemplates = [
  (g, cn, sn, loc, hn) => ({ subject: `Quick one for ${sn}`, body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most law firms I speak to are losing hours a week to manual client intake, document chasing, and case file admin.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g} — legal admin question` : `${sn} — legal admin question`, body: `Hi ${g},\n\nRunning a law firm in ${loc} usually means chasing clients for documents, manually logging case updates, and juggling intake forms across systems.\n\nWe build lightweight automation for firms like ${cn} — things like automated client intake, document collection workflows, and deadline reminders that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Scaling ${sn} without hiring`, body: `Hi ${g},\n\nMost law firms I talk to in ${loc} hit the same ceiling — more clients means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (client intake, document chasing, deadline tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`, body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend chasing clients for documents, logging case updates, and managing intake forms each week?\n\nMost law firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `${sn} — quick thought`, body: `Hi ${g},\n\nA lot of law firms in ${loc} are still running on manual emails and spreadsheets for client intake, document tracking, and deadline management.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`, body: `Hi ${g},\n\nI work with law firms around ${loc} — most are burning hours on admin that could easily be automated (client intake, document workflows, deadline tracking).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `Quick question for ${g}` : `Quick question regarding ${sn}`, body: `Hi ${g},\n\nI was looking at ${cn} and noticed you're based in ${loc}. Many law firms we speak with are struggling with the sheer volume of manual intake and document chasing.\n\nAt Relay, we build custom automation systems that do this heavy lifting for you. We can automate client onboarding, document workflows, and case updates.\n\nWould you be open to a 10-minute free audit to see how much time we could save you?` }),
  (g, cn, sn, loc, hn) => ({ subject: `Automating admin at ${sn}`, body: `Hi ${g},\n\nMost law firms in ${loc} tell us that client follow-ups and manual form processing are the biggest drains on their time.\n\nWe run Relay, and we specialize in building small, tailored automation systems for firms like ${cn} to handle exactly these tasks in the background.\n\nIf you're curious about how it works, I'd love to offer a free 10-minute audit. No obligation. Just reply if interested.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, ideas for ${sn}` : `Ideas for ${sn}`, body: `Hi ${g},\n\nGrowing a law firm in ${loc} shouldn't mean drowning in admin. Yet, manual data entry and case tracking still eat up hours every week.\n\nWe build custom automation for firms like ${cn} that run silently in the background, freeing up your team to focus on billable work.\n\nI'm offering a free, quick audit to show you what's possible. Let me know if you have 10 minutes this week.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Less admin, more capacity for ${sn}`, body: `Hi ${g},\n\nI'm reaching out because we help legal practices in ${loc} take on more clients without hiring more support staff.\n\nAt Relay, we build lightweight systems that automate client reminders, document collection, and deadline tasks. It's custom-built for how ${cn} operates.\n\nHappy to show you how during a free 10-minute audit. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Quick thought on ${cn}`, body: `Hi ${g},\n\nA lot of law firms around ${loc} rely heavily on manual emails and spreadsheets for tracking deadlines and client docs.\n\nAt Relay, we replace that overhead with simple, tailored automation. It allows you to scale ${sn} smoothly.\n\nWorth a brief call to see if this fits? I'm happy to do a free audit.` })
];

const propertyTemplates = [
  (g, cn, sn, loc, hn) => ({ subject: `Quick one for ${sn}`, body: `Hi ${g},\n\nNoticed you're running ${cn} in ${loc} — most property management firms I speak to are losing hours a week to manual scheduling, tenant follow-ups, or chasing maintenance requests.\n\nI run Relay, we build small automation systems that handle that kind of admin in the background. I'd like to offer a free audit — no cost, no obligation, just a quick look at where automation could save you time.\n\nWorth a 10 minute call this week?` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g} — property admin question` : `${sn} — property admin question`, body: `Hi ${g},\n\nRunning a property management operation in ${loc} usually means chasing rent arrears, fielding maintenance calls, and juggling tenant comms manually.\n\nWe build lightweight automation for firms like ${cn} — things like automated rent reminders, maintenance tracking, and tenant onboarding that run in the background.\n\nHappy to do a quick free audit if you're curious — just reply to this email.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Scaling ${sn} without hiring`, body: `Hi ${g},\n\nMost property managers I talk to in ${loc} hit the same ceiling — more properties means more admin, and hiring to keep up eats into margins.\n\nAt Relay we build custom systems that handle the repetitive stuff (tenant comms, scheduling, payment tracking) so you can take on more without adding headcount.\n\nIf you're interested, I'll do a free 10-minute audit. Just reply here.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, quick question about ${sn}` : `Quick question for ${sn}`, body: `Hi ${g},\n\nCurious — how much time does your team at ${cn} spend fielding tenant queries and maintenance requests each week?\n\nMost property firms in ${loc} I've spoken with are surprised how much of that can run on autopilot. We build small, tailored systems that handle it.\n\nI'd like to offer a free audit — no strings, just a quick look. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `${sn} — quick thought`, body: `Hi ${g},\n\nA lot of property management firms in ${loc} are still running on spreadsheets and manual emails for tenant comms, rent chasing, and maintenance logs.\n\nAt Relay we build simple automation that replaces that admin overhead — custom-built for how ${cn} actually works.\n\nWorth a quick 10-minute call? No pressure, just a free audit to see if there's anything worth automating.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `For ${g} at ${sn}` : `Quick intro for ${sn}`, body: `Hi ${g},\n\nI work with property management firms around ${loc} — most are burning hours on admin that could easily be automated (rent reminders, maintenance workflows, tenant onboarding).\n\nI'd like to offer ${cn} a free, no-obligation audit to see where you could save time.\n\nInterested? Just reply and we'll find 10 minutes.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `Quick question for ${g}` : `Quick question regarding ${sn}`, body: `Hi ${g},\n\nI was looking at ${cn} and noticed you're based in ${loc}. Many property management firms we speak with are struggling with the sheer volume of manual tenant follow-ups and maintenance logs.\n\nAt Relay, we build custom automation systems that do this heavy lifting for you. We can automate tenant onboarding, rent reminders, and maintenance workflows.\n\nWould you be open to a 10-minute free audit to see how much time we could save you?` }),
  (g, cn, sn, loc, hn) => ({ subject: `Automating admin at ${sn}`, body: `Hi ${g},\n\nMost property managers in ${loc} tell us that rent chasing and manual maintenance tracking are the biggest drains on their time.\n\nWe run Relay, and we specialize in building small, tailored automation systems for firms like ${cn} to handle exactly these tasks in the background.\n\nIf you're curious about how it works, I'd love to offer a free 10-minute audit. No obligation. Just reply if interested.` }),
  (g, cn, sn, loc, hn) => ({ subject: hn ? `${g}, ideas for ${sn}` : `Ideas for ${sn}`, body: `Hi ${g},\n\nGrowing a property portfolio in ${loc} shouldn't mean drowning in admin. Yet, manual comms and maintenance coordination still eat up hours every week.\n\nWe build custom automation for firms like ${cn} that run silently in the background, freeing up your team to focus on growth.\n\nI'm offering a free, quick audit to show you what's possible. Let me know if you have 10 minutes this week.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Less admin, more capacity for ${sn}`, body: `Hi ${g},\n\nI'm reaching out because we help property firms in ${loc} manage more units without hiring more staff.\n\nAt Relay, we build lightweight systems that automate tenant reminders, maintenance tracking, and renewals. It's custom-built for how ${cn} operates.\n\nHappy to show you how during a free 10-minute audit. Reply if you're open to it.` }),
  (g, cn, sn, loc, hn) => ({ subject: `Quick thought on ${cn}`, body: `Hi ${g},\n\nA lot of property management firms around ${loc} rely heavily on manual emails and spreadsheets for tracking maintenance and tenant queries.\n\nAt Relay, we replace that overhead with simple, tailored automation. It allows you to scale ${sn} smoothly.\n\nWorth a brief call to see if this fits? I'm happy to do a free audit.` })
];

const NICHE_TEMPLATES = {
  'Accounting Firms in Birmingham': accountingTemplates,
  'Dental/Healthcare': dentalTemplates,
  'Legal Services': legalTemplates,
  'Property Management': propertyTemplates,
};

function generateFallbackEmail(lead, niche) {
  const greeting = extractFirstName(lead.name) || 'there';
  const companyName = cleanCompanyName(lead.company) || 'your firm';
  const sn = shortName(companyName);
  const location = cleanLocation(lead.location);
  const hasName = greeting !== 'there';
  const templates = NICHE_TEMPLATES[niche] || accountingTemplates;

  const hash = lead.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const templateIndex = hash % templates.length;

  return templates[templateIndex](greeting, companyName, sn, location, hasName);
}

export async function runProcessCampaign() {
  let qe = null;
  try {
    const n = Ne(Ae, Re),
      { data: pe } = await n
        .from("api_keys")
        .select("key_value")
        .eq("service", "disable_deepseek")
        .maybeSingle(),
      ge = pe?.key_value === "true";

    const { data: allDbAccounts } = await n.from('email_accounts').select('name, email, company');
    const globalNamesToStrip = new Set();
    if (allDbAccounts) {
      for (const acct of allDbAccounts) {
        if (acct.name) {
          globalNamesToStrip.add(acct.name.trim());
          const first = acct.name.split(' ')[0].trim();
          if (first) globalNamesToStrip.add(first);
        }
        if (acct.email) {
          const prefix = acct.email.split('@')[0].trim();
          if (prefix) {
            globalNamesToStrip.add(prefix);
            globalNamesToStrip.add(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
        if (acct.company) {
          globalNamesToStrip.add(acct.company.trim());
        }
      }
    }
    globalNamesToStrip.add("Ethan");
    globalNamesToStrip.add("Clara");
    globalNamesToStrip.add("Relay Solutions");
    globalNamesToStrip.add("MrMedic");
    globalNamesToStrip.add("MrMedic Events");
    console.log("Checking engine status...");
    const { data: _e } = await n
      .from("agent_memory")
      .select("value")
      .eq("key_name", "factory_status")
      .maybeSingle();
    if (_e?.value?.status === "paused")
      return (
        console.log("Engine is PAUSED. Standing by."),
        JSON.stringify({ message: "Engine paused" })
      );
    console.log("Checking for scheduled campaigns...");
    const { data: q, error: x } = await n
      .from("scheduled_emails")
      .select(
        `
            *,
            campaigns!scheduled_emails_campaign_id_fkey!inner (
                id, name, status, company_name, contact_number, primary_email, business_id, niche,
                businesses!inner (
                    id, name, status, signature_template
                )
            ),
            templates!scheduled_emails_template_id_fkey!inner (*)
        `,
      )
      .eq("status", "scheduled")
      .in("campaigns.status", ["in_progress", "email_only", "active"])
      .eq("campaigns.businesses.status", "active");
    if (x) throw (console.error("Database query error:", x), x);
    if (!q || q.length === 0)
      return JSON.stringify({ message: "No active schedules" });
    const L = (q || []).filter((e) => {
      const o = e.campaigns,
        m = o?.businesses;
      return !m || m.status !== "active"
        ? (console.log(
            `Skipping schedule ${e.id} because business status is not active (status: ${m?.status})`,
          ),
          !1)
        : !0;
    });
    if (L.length === 0)
      return JSON.stringify({ message: "No active schedules (all filtered or inactive)" });
    const z = [],
      $ = new Map();
    // ═══ FIX 2: GLOBAL MEMORY LOCK FOR DEDUP ═══
    const globalTargetedEmails = new Set();
    // ═══ FIX 1: SMTP CONNECTION POOL ═══
    const smtpPool = new Map();

    for (const e of L) {
      const o = e.campaign_id;
      ($.has(o) || $.set(o, []), $.get(o).push(e));
    }
    for (const [e, o] of $)
      o.sort(
        (m, P) =>
          new Date(m.created_at).getTime() - new Date(P.created_at).getTime(),
      );
    // ═══ PARALLEL CAMPAIGN PROCESSING ═══
    // Process each campaign concurrently (all 5 at once) instead of sequentially
    const _processCampaignSchedules = async (campaignSchedules) => {
      const campResults = [];
      for (const e of campaignSchedules) {
      const o = new Date(),
        m = new Date(e.end_date),
        P = new Date(e.scheduled_for);
      if (o > m) continue;
      if (o < P) {
        console.log(
          `Skipping schedule ${e.id}: Not due until ${P.toISOString()}`,
        );
        continue;
      }
      const J = $.get(e.campaign_id) || [],
        v = J.findIndex((t) => t.id === e.id);
      if (v > 0) {
        console.log(`Step ${v + 1} (schedule ${e.id}): Sequence enforcement enabled per-lead.`);
      }
      const K = Math.max(1, e.interval_minutes || 2);
      const { data: M } = await n
        .from("schedule_email_accounts")
        .select("*, email_accounts!inner(*)")
        .eq("schedule_id", e.id);
      if (!M || M.length === 0) continue;
      
      const u = [];
      for (const sa of M) {
        const { data: lastSentAcc } = await n
          .from("campaign_progress")
          .select("sent_at")
          .eq("campaign_id", e.campaign_id)
          .eq("schedule_id", e.id)
          .eq("email_account_id", sa.email_accounts.id)
          .eq("status", "sent")
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (lastSentAcc?.sent_at && process.env.FORCE_RUN !== "true") {
          const mins = (o.getTime() - new Date(lastSentAcc.sent_at).getTime()) / 60000;
          if (mins < K) {
            console.log(`[Rate Limit] Skipping account ${sa.email_accounts.email} for schedule ${e.id}: ${Math.round(mins)}min since last (need ${K}min).`);
            continue;
          }
        }
        u.push(sa);
      }
      
      if (u.length === 0) {
        console.log(`Schedule ${e.id}: All accounts are currently throttled (rate limited).`);
        continue;
      }
      let { data: f, error: W } = await n
        .rpc("get_pending_campaign_leads", {
          campaign_id_param: e.campaign_id,
          schedule_id_param: e.id,
        })
        .limit(u.length * (e.emails_per_account || 500));
      if (W) {
        console.error("Error fetching pending leads", W);
        continue;
      }
      if (!f || f.length === 0) {
        console.log(`Schedule ${e.id}: No pending leads.`);
        continue;
      }

      // Per-lead sequence check: if this is > Step 1, verify they completed the previous step
      if (v > 0) {
        const prevScheduleId = J[v - 1].id;
        const leadIds = f.map(l => l.id);
        const { data: prevProgress } = await n
             .from("campaign_progress")
             .select("lead_id, sent_at")
             .eq("campaign_id", e.campaign_id)
             .eq("schedule_id", prevScheduleId)
             .eq("status", "sent")
             .in("lead_id", leadIds);
             
        const requiredDelayMs = Math.max(1, e.interval_minutes || 0) * 60 * 1000;
        const nowTime = new Date().getTime();
        const validSequenceLeadIds = new Set();
        
        if (prevProgress) {
             for (const p of prevProgress) {
                 if (p.sent_at) {
                     const timeSincePrev = nowTime - new Date(p.sent_at).getTime();
                     if (timeSincePrev >= requiredDelayMs) {
                         validSequenceLeadIds.add(p.lead_id);
                     }
                 }
             }
        }
        
        const validSequenceLeads = f.filter(l => validSequenceLeadIds.has(l.id));
        if (validSequenceLeads.length < f.length) {
             console.log(`Schedule ${e.id} (Step ${v+1}): Filtered ${f.length - validSequenceLeads.length} leads waiting for previous step completion or interval delay.`);
        }
        f = validSequenceLeads;
      }

      if (f.length === 0) {
        console.log(`Schedule ${e.id} (Step ${v+1}): No pending leads after sequence delay filtering.`);
        continue;
      }
      
      const H = f.map((t) => t.email).filter(Boolean);
      let blockedSet = new Set();
      if (H.length > 0) {
          const { data: globalBlacklisted } = await n.from("global_blacklist").select("email").in("email", H);
          if (globalBlacklisted) globalBlacklisted.forEach(b => blockedSet.add(b.email.toLowerCase()));
          
          const bId = e.campaigns?.business_id;
          if (bId) {
              const { data: businessOptOuts } = await n.from("business_opt_outs").select("email").eq("business_id", bId).in("email", H);
              if (businessOptOuts) businessOptOuts.forEach(b => blockedSet.add(b.email.toLowerCase()));
          }
      }
      
      const validLeads = f.filter(l => l.email && !blockedSet.has(l.email.toLowerCase()));
      if (validLeads.length < f.length) {
          console.log(`Schedule ${e.id}: Filtered ${f.length - validLeads.length} leads due to global blacklist or business opt-out.`);
      }
      f = validLeads;

      if (f.length === 0) {
        console.log(`Schedule ${e.id}: No pending leads after blacklist filtering.`);
        continue;
      }
      let A = new Set();
      if (H.length > 0) {
        const { data: t } = await n
          .from("campaign_progress")
          .select("leads!inner(email)")
          .neq("campaign_id", e.campaign_id)
          .eq("status", "sent")
          .in("leads.email", H);
        if (t)
          for (const a of t)
            a.leads?.email && A.add(a.leads.email.toLowerCase());
        A.size > 0 &&
          console.log(
            `[DEDUP] Filtering ${A.size} leads already targeted by other campaigns.`,
          );
      }
      console.log(
        `Schedule ${e.id}: Processing ${f.length} leads across ${u.length} accounts.`,
      );
      let fe = 0,
        G = 0;
      for (const t of f) {
        if (!t.email || t.email.trim() === "" || !t.email.includes("@")) {
          (console.warn(`Skipping lead ${t.id}: Invalid email "${t.email}"`),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: u[0].email_accounts.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        const lowerEmail = t.email.toLowerCase();
        if (A.has(lowerEmail) || globalTargetedEmails.has(lowerEmail)) {
          (console.log(
            `[DEDUP] Skipping lead ${t.email}: Already targeted by another campaign or locked in memory.`,
          ),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: u[0].email_accounts.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        if (
          ["interested", "replied", "unsubscribed", "bounced"].includes(
            t.status,
          )
        ) {
          (console.log(`Skipping lead ${t.email}: Status is ${t.status}`),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: u[0].email_accounts.id,
                  status:
                    t.status === "unsubscribed" ? "unsubscribed" : "replied",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        
        // ═══ FIX 2: APPLY MEMORY LOCK ═══
        globalTargetedEmails.add(lowerEmail);

        let a = null;
        if (t.assigned_email_account_id) {
          const s = u.find(
            (i) => i.email_accounts.id === t.assigned_email_account_id,
          );
          if (s) a = s.email_accounts;
          else {
            const { data: i } = await n
              .from("email_accounts")
              .select("*")
              .eq("id", t.assigned_email_account_id)
              .single();
            i &&
              ((a = i),
              console.log(
                `Lead ${t.email} using consistently assigned account ${a.email} even if not explicitly in schedule.`,
              ));
          }
        }
        if (!a) {
          ((a = u[G % u.length].email_accounts), G++);
          try {
            await n
              .from("campaign_leads")
              .update({ assigned_email_account_id: a.id })
              .eq("campaign_id", e.campaign_id)
              .eq("lead_id", t.id);
          } catch (i) {
            console.error("Failed to save assignment", i);
          }
        }
        let C = null,
          j = null,
          h = null;
        try {
          const { data: s } = await n
            .from("inbox_emails")
            .select("subject, body_text, received_at")
            .eq("campaign_id", e.campaign_id)
            .eq("to", t.email)
            .eq("folder", "sent")
            .order("received_at", { ascending: !1 })
            .limit(1);
          if (s && s.length > 0) {
            const i = s[0];
            ((j = i.body_text), (h = i.subject));
            let R = i.subject
              .replace(/^(Re|Fwd|Fw|Aw|Reply):\s*/i, "")
              .trim()
              .replace(/[%_]/g, "\\$&");
            const { data: r } = await n
              .from("inbox_emails")
              .select("body_text, received_at")
              .eq("folder", "inbox")
              .gte("received_at", i.received_at)
              .or(`from.ilike.%${t.email}%,subject.ilike.%${R}%`)
              .order("received_at", { ascending: !0 });
            r &&
              r.length > 0 &&
              (C = r.map((c) => c.body_text).join(`
---
`));
          }
        } catch (s) {
          console.error("Error scanning inbox", s);
        }
        if (C) {
          (console.log(
            `[Campaign ${e.campaign_id}] Lead ${t.email} replied. Halting sequence.`,
          ),
            await n
              .from("leads")
              .update({ status: "interested" })
              .eq("id", t.id),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "replied",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          const { data: s } = await n
            .from("scheduled_emails")
            .select("id")
            .eq("campaign_id", e.campaign_id)
            .neq("id", e.id);
          if (s && s.length > 0)
            for (const i of s)
              await n
                .from("campaign_progress")
                .upsert(
                  {
                    campaign_id: e.campaign_id,
                    schedule_id: i.id,
                    lead_id: t.id,
                    email_account_id: a.id,
                    status: "replied",
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "campaign_id,schedule_id,lead_id" },
                );
          continue;
        }
        let p = (t.name || "").trim(),
          N = (t.company || "").trim(),
          y = p.split(" ")[0];
        const D = p.toLowerCase();
        const businessKeywords = ['ltd', 'limited', 'llc', 'inc', 'agency', 'digital', 'marketing', 'consulting', 'solutions', 'services', 'group', 'partners', 'associates', 'studio', 'entertainment', 'warehouse', 'management', 'technologies', 'designs', 'property', 'properties', 'real estate', 'clinic', 'dental', 'medical', 'events'];
        const isBusinessName = businessKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(D));
        const nameIsUnusable = !p || D === 'the' || D.startsWith('the ') ||
            D.startsWith('a ') || D.startsWith('an ') ||
            (N && D === N.toLowerCase()) ||
            isBusinessName || p.split(' ').length > 3;
        if (nameIsUnusable) {
          if (N && N.length > 1 && N.length <= 30) {
            y = N;
          } else {
            y = 'there';
          }
        } else {
          y = y.charAt(0).toUpperCase() + y.slice(1).toLowerCase();
        }
        let S = t.personalized_email,
          E = t.personalized_subject;
        const he = v === 0,
          ye =
            e.templates.content.includes("{") ||
            e.templates.content.includes("[") ||
            e.templates.subject.includes("{") ||
            e.templates.subject.includes("[");
        
        const hasValidSummary = t.summary && 
                                t.summary.trim() !== "" && 
                                !t.summary.toLowerCase().includes("failed to perform") &&
                                !t.summary.toLowerCase().includes("could not complete");

        const needsPersonalization = true; // User requested ALL emails to be personalized (No 2 emails should be the same)
        
        if (needsPersonalization && !hasValidSummary) {
          console.log(`[PERSONALIZATION BLOCK] Lead ${t.email} has no summary. Using rule-based fallback personalizer...`);
          try {
            const fallback = generateFallbackEmail(t, e.campaigns?.niche || "");
            S = fallback.body;
            E = fallback.subject;
            console.log(`[Fallback Personalizer] Personalization succeeded for ${t.email}`);
            await n
              .from("leads")
              .update({ personalized_email: S, personalized_subject: E })
              .eq("id", t.id);
          } catch (fallbackErr) {
            console.error("Fallback personalization failed:", fallbackErr);
            continue;
          }
        } else if (needsPersonalization && hasValidSummary) {
          try {
            const s = y;
            let i = e.templates.content
              .replace(/\n*\{ender\}[\s\S]*$/i, "")
              .replace(/\n*\{\{ender\}\}[\s\S]*$/i, "")
              .replace(/\n*\[Sender Name\][\s\S]*$/i, "")
              .replace(/\n*<company>[\s\S]*$/i, "")
              .trim();
            const k =
                `You are a witty, world-class B2B cold outreach specialist. You write curiosity-based emails that make prospects think about their own pain points — NOT sales pitches.

CRITICAL RULES:
1. Start with EXACTLY: "Hi " + lead's first name + ",". If no name, use "Hi there,". NEVER just "there,".
2. DO NOT return placeholders. Return the FINISHED email.
3. Write a SHORT curiosity-based message (max 60 words). Frame it as a QUESTION about their pain point, NOT a pitch. Be conversational, direct, and human. Inquire about current struggles and hurdles. NO 2 EMAILS SHOULD BE THE SAME!
4. DO NOT pitch our services directly. Instead, hint at a better way and ask if they'd be curious to see it. The goal is to start a conversation, not close a deal.
5. ABSOLUTELY DO NOT include any sign-off, closing, or signature. No Best, Regards, Cheers, Thanks, Sincerely, or ANY name at the end. The system auto-appends the sender signature.
6. Output ONLY valid JSON: { "subject": "Customized subject line", "body": "Finished email body without any sign-off" }
7. The subject line MUST be hyper-personalized to the lead's website, email, and goals. It should be curiosity-driven and under 9 words. No salesy subjects.`,
              R =
                'Original Template Subject: "' +
                e.templates.subject +
                `"
Original Template Body: "` +
                i +
                `"
Lead Name: ` +
                s +
                `
Lead Company: ` +
                (t.company || "their business") +
                `
Lead Email: ` +
                (t.email || "Unknown") +
                `
Lead Website: ` +
                (t.website || "Unknown") +
                `
Lead Goals & Notes: "` +
                (t.summary || "") +
                `"

Instructions: You MUST deeply personalize BOTH the subject and the body to this specific lead using their website, email, and goals/notes. No two emails should be the same. Ensure the transition from the personalized opening to the core message is seamless.`;
            let r;
            if (ge) {
              console.log(
                "DeepSeek is disabled. Trying OpenRouter key cycling...",
              );
              let c = !1;
              for (let d = 0; d < ue.length; d++) {
                const U = ue[d];
                try {
                  const l = await fetch(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${U}`,
                        "HTTP-Referer": "https://github.com/Openclaw-Factory",
                        "X-Title": "ColdSpark",
                      },
                      body: JSON.stringify({
                        model: "openrouter/owl-alpha",
                        messages: [
                          { role: "system", content: k },
                          { role: "user", content: R },
                        ],
                        response_format: { type: "json_object" },
                      }),
                    },
                  );
                  if (l.ok) {
                    const I = await l.json();
                    if (I && !I.error && I.choices?.[0]) {
                      ((r = {
                        status: 200,
                        ok: !0,
                        json: async () => I,
                        text: async () => JSON.stringify(I),
                      }),
                        (c = !0));
                      break;
                    } else
                      console.error(
                        `OpenRouter Key ${d + 1} API Error:`,
                        I?.error?.message || JSON.stringify(I?.error),
                      );
                  } else
                    console.error(
                      `OpenRouter Key ${d + 1} Status Error:`,
                      l.status,
                      await l.text(),
                    );
                } catch (l) {
                  console.error(
                    `OpenRouter Key ${d + 1} Network/Timeout Error:`,
                    l,
                  );
                }
              }
              c ||
                (r = {
                  status: 402,
                  ok: !1,
                  json: async () => ({ error: "All OpenRouter keys failed" }),
                  text: async () => "All OpenRouter keys failed",
                });
            } else
              r = await fetch(Pe + "/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + Te,
                },
                body: JSON.stringify({
                  model: "deepseek-chat",
                  messages: [
                    { role: "system", content: k },
                    { role: "user", content: R },
                  ],
                  response_format: { type: "json_object" },
                }),
              });
            if (r.status === 402 || r.status === 429 || !r.ok) {
              const c = await r.text();
              console.error(`DeepSeek API Error (status ${r.status}):`, c);
              if (
                r.status === 402 ||
                c.toLowerCase().includes("balance") ||
                c.toLowerCase().includes("credit") ||
                c.toLowerCase().includes("insufficient")
              ) {
                console.log("Credit exhaustion detected! Triggering rule-based fallback...");
                throw new Error("AI_CREDITS_EXHAUSTED");
              }
              throw new Error(`DeepSeek API non-ok response (${r.status}): ${c}`);
            } else {
              const c = await r.json();
              if (c.choices && c.choices[0]) {
                const d = c.choices[0].message.content.trim();
                try {
                  let cleanStr = d.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
                  const l = JSON.parse(cleanStr);
                  S = l.body || l.Body || cleanStr;
                  E = l.subject || l.Subject || "";
                } catch (err) {
                  const bodyMatch = d.match(/"body"\s*:\s*"([\s\S]*?)"\s*\}?/i);
                  if (bodyMatch && bodyMatch[1]) {
                    S = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                  } else {
                    S = d.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
                  }
                }
                await n
                  .from("leads")
                  .update({ personalized_email: S, personalized_subject: E })
                  .eq("id", t.id);
              }
            }
          } catch (s) {
            console.error("AI Personalization Failed, attempting fallback:", s.message || s);
            try {
              const fallback = generateFallbackEmail(t, e.campaigns?.niche || "");
              S = fallback.body;
              E = fallback.subject;
              console.log(`[Fallback Personalizer] Personalization succeeded for ${t.email}`);
              await n
                .from("leads")
                .update({ personalized_email: S, personalized_subject: E })
                .eq("id", t.id);
            } catch (fallbackErr) {
              console.error("Fallback personalization failed:", fallbackErr);
              console.log(`[AI Retry Queue] Skipping lead ${t.email} due to fallback failure.`);
              continue;
            }
          }
        }
        (S || (S = e.templates.content), E || (E = e.templates.subject));
        let b = "Sender";
        a.name
          ? (b = a.name.split(" ")[0])
          : a.email &&
            ((b = a.email.split("@")[0]),
            (b = b.charAt(0).toUpperCase() + b.slice(1)));
        const Se = e.campaigns.contact_number || a.phone_number || "",
          V = e.campaigns.company_name || a.company || "",
          be = a.name || b,
          we = a.email,
          X = [
            "Best,",
            "Kind regards,",
            "Regards,",
            "Warm regards,",
            "Cheers,",
          ],
          Q = X[Math.floor(Math.random() * X.length)];
        let O = S;
        // ═══ FIX: ALWAYS STRIP EXISTING SIGN-OFFS, THEN APPEND CORRECT ONE ═══
        let strippedBody = O;

        // Strip sender names/companies explicitly to prevent double sign-off
        const senderFullName = a.name || b;
        const localNamesToStrip = [senderFullName, b, V, a.email?.split('@')[0]].filter(Boolean);
        const combinedNames = new Set([...localNamesToStrip, ...globalNamesToStrip]);
        
        // Strip common sign-off words + names
        for (const name of combinedNames) {
          if (!name || name.length < 3) continue; // Skip very short names
          const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Match optional sign-off word followed by the name at the end of the email
          const nameStripRegex = new RegExp(`\\n*\\s*(?:Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward|Yours|Ender)[,:]?\\s*\\n*\\s*${safeName}[\\s\\S]{0,200}$`, 'i');
          strippedBody = strippedBody.replace(nameStripRegex, '').trimEnd();
          
          // Also just match the name by itself at the end of the email
          const exactNameRegex = new RegExp(`\\n+\\s*${safeName}[\\s\\S]{0,100}$`, 'i');
          strippedBody = strippedBody.replace(exactNameRegex, '').trimEnd();
        }
        
        // Strip sign-offs at the end
        const signOffStrip = /\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*(?:\n[\s\S]{0,200}|\s*$)/i;
        strippedBody = strippedBody.replace(signOffStrip, '').trimEnd();
        
        // Also strip any standalone URL-only lines at the very end
        strippedBody = strippedBody.replace(/\n+\s*(?:https?:\/\/|www\.)[^\s]+\s*$/i, "").trimEnd();

        // Also strip {ender} placeholders and everything after them
        strippedBody = strippedBody
            .replace(/\n*\s*\{\{?ender\}\}?[\s\S]*$/i, '')
            .replace(/\n*\s*\[Sender Name\][\s\S]*$/i, '')
            .trimEnd();

        O = strippedBody;
        
        const Z = a.signature ? a.signature.trim() : "";
        let ie = "";
        if (v === 0) {
          ie = "Not the right time? Just let me know and I'll update my records.";
        } else if (v === 4) {
          ie = "Still not the right time? Just let me know and I'll update my records.";
        }

        const oe = e.campaigns?.businesses?.signature_template || "";

        
        // Check if the signature template already acts as the primary sign-off
        const hasSignOff = /(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward)/i.test(oe);
        const hasName = oe.includes('{{sender_name}}') || oe.includes('{sender_name}') || oe.includes('[Sender Name]') || (senderFullName && oe.toLowerCase().includes(senderFullName.toLowerCase())) || (b && oe.toLowerCase().includes(b.toLowerCase()));
        const templateActsAsSignature = hasSignOff || hasName;

        let F;
        if (templateActsAsSignature) {
          F = `${O}${ie ? '\n\n' + ie : ''}`;
        } else if (Z) {
          F = `${O}\n\n${Z}${ie ? '\n\n' + ie : ''}`;
        } else {
          const s = a.name || b;
          F = `${O}\n\n${Q}\n${s}\n${V}${ie ? '\n\n' + ie : ''}`.trimEnd();
        }

        // NOTE: Post-assembly name stripping REMOVED.
        // Sign-off stripping already happens on O (body) BEFORE the signature is built.
        // The old code here was stripping the sender's name AFTER it was correctly appended,
        // which caused the footer to lose the sender name entirely.

        const Ce = [
            {
              pattern:
                /{{first_name}}|{first_name}|{firstName}|\[First Name\]/gi,
              val: y,
            },
            { pattern: /{{name}}|{name}|\[Name\]/gi, val: t.name || y },
            {
              pattern: /{{company}}|{company}|{companyName}|{{org_name}}|{org_name}|\[Company\]/gi,
              val: N || "your business",
            },
            {
              pattern: /{{industry}}|{industry}/gi,
              val: t.industry || "industry",
            },
            { pattern: /{{location}}|{location}/gi, val: t.location || "" },
            {
              pattern: /{{sender_name}}|{sender_name}|\[Sender Name\]/gi,
              val: be,
            },
            {
              pattern:
                /{{sender_email}}|{sender_email}|<primaryemail>|\[Email\]/gi,
              val: we,
            },
            {
              pattern:
                /{{sender_phone}}|{sender_phone}|<contactnumber>|\[Phone\]/gi,
              val: Se,
            },
            {
              pattern: /{{sender_company}}|{sender_company}|<company>/gi,
              val: V,
            },
            { pattern: /{{ender}}|{ender}/gi, val: Q },
          ];

        let subjectFirstName = y;
        if (y.toLowerCase() === 'there') {
           subjectFirstName = N ? N : 'Your Business';
        }

        let re = F;
        if (oe) {
          // Strip HTML from the signature template and remove any hardcoded opt-out link
          let plainTextOe = oe.replace(/<[^>]+>/g, '').trim();
          plainTextOe = plainTextOe.replace(/To opt out of future emails.*$/i, '').trim();
          re += "\n\n" + plainTextOe;
        }

        let g = re,
          T = E;
        Ce.forEach((s) => {
          g = g.replace(s.pattern, s.val);
          // For subject, use the specialized first name to avoid "there - secure portals"
          if (s.pattern.source.includes('first_name')) {
             T = T.replace(s.pattern, subjectFirstName);
          } else {
             T = T.replace(s.pattern, s.val);
          }
        });
        
        // ═══ GREETING CLEANUP ═══
        g = g.replace(/^\s*(hi\s+)?(there|friend),/i, "Hi there,");
        g = g.replace(/^\s*([A-Z][a-z]+),/i, "Hi $1,");
        
        // Strip any remaining HTML just in case
        g = g.replace(/<[^>]+>/g, '');
        // Fix any weird Subject capitalization if we put "Your Business" at the start
        T = T.charAt(0).toUpperCase() + T.slice(1);
        

        const ce = /{{.*?}}|{.*?}|\[.*?\]/g,
          de = (g.match(ce) || []).filter((s) => !s.match(/^\[\s*\]$/)),
          le = T.match(ce) || [];
        if (de.length > 0 || le.length > 0) {
          (console.warn("Found unreplaced placeholders, marking as failed:", [
            ...de,
            ...le,
          ]),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "failed",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          continue;
        }
        const { data: me } = await n.rpc("decrypt_password", {
          encrypted_password: a.encrypted_password,
        });
        if (!me) {
          console.error("Failed to decrypt password for account", a.email);
          continue;
        }
        const B = a.email.toLowerCase();
        if (B) {
          // Track limits per individual email account (500 emails per account)
          const { data: s } = await n.rpc("increment_domain_email_count", {
            p_domain: B, // B is now the full email address, tracking per account
            p_max_limit: 500,
          });
          if (!s) {
            console.log(`Account limit reached for ${B}. Skipping account.`);
            continue;
          }
        }
        try {
          if (!smtpPool.has(a.id)) {
            smtpPool.set(a.id, De.createTransport({
              host: a.smtp_host,
              port: Number(a.smtp_port),
              secure: Number(a.smtp_port) === 465,
              auth: { user: a.email, pass: me },
            }));
          }
          const transporter = smtpPool.get(a.id);

          (await transporter.sendMail({
            from: a.name ? '"' + a.name + '" <' + a.email + ">" : a.email,
            to: t.email,
            subject: T,
            text: g,
          }),
            await n
              .from("campaign_progress")
              .upsert(
                {
                  campaign_id: e.campaign_id,
                  schedule_id: e.id,
                  lead_id: t.id,
                  email_account_id: a.id,
                  status: "sent",
                  sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "campaign_id,schedule_id,lead_id" },
              ));
          const { data: i } = await n
            .from("scheduled_emails")
            .select("sent_emails")
            .eq("id", e.id)
            .single();
          i &&
            (await n
              .from("scheduled_emails")
              .update({ sent_emails: (i.sent_emails || 0) + 1 })
              .eq("id", e.id));
          const { error: k } = await n
            .from("inbox_emails")
            .insert({
              email_account_id: a.id,
              folder: "sent",
              uid: Math.floor(Math.random() * 1e9),
              from: a.name ? '"' + a.name + '" <' + a.email + '>' : a.email,
              to: t.email,
              subject: T,
              body_text: g,
              body_html: g.replace(/\n/g, "<br/>"),
              snippet: g.substring(0, 100),
              received_at: new Date().toISOString(),
              is_read: !0,
              campaign_id: e.campaign_id,
              sequence_step: e.templates.name,
            });
          (k
            ? (console.error("\u274C Inbox Insert Failed:", k.message),
              await n
                .from("debug_logs")
                .insert({
                  level: "error",
                  message: `Failed to insert sent email to inbox: ${k.message}`,
                  context: { schedule_id: e.id, lead_id: t.id },
                }))
            : console.log("\u2705 Sent email persisted to inbox."),
            fe++,
            z.push({ email: t.email, status: "sent", from: a.email }));
        } catch (s) {
          // FIX: Classify SMTP errors — 5xx codes are permanent bounces, everything else is retryable
          const errMsg = s?.message || String(s);
          const errCode = s?.responseCode || 0;
          const isPermanentBounce = errCode >= 500 || /5\d{2}|rejected|does not exist|mailbox not found|user unknown|no such user|invalid recipient/i.test(errMsg);
          
          if (isPermanentBounce) {
            console.error(`\u274C Send bounced (code ${errCode}):`, errMsg);
            await n
                .from("campaign_progress")
                .upsert(
                  {
                    campaign_id: e.campaign_id,
                    schedule_id: e.id,
                    lead_id: t.id,
                    email_account_id: a.id,
                    status: "bounced",
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "campaign_id,schedule_id,lead_id" },
                );
            // If permanent bounce, also update the lead status so they're excluded from all future campaigns
            await n.from("leads").update({ status: "bounced" }).eq("id", t.id);
          } else {
            console.error(`\u274C Send temporary failure/rate limit (code ${errCode}):`, errMsg);
            console.log("Not marking as failed. Keeping lead as pending to retry on next run.");
            // Do not insert 'failed' status to campaign_progress. 
            // This pauses the emails for this lead, preventing step 2 from triggering prematurely.
          }
        }
      }
      if (f && f.length > 0) {
        const t = new Date(o.getTime() + (e.interval_minutes || 5) * 6e4);
        await n
          .from("scheduled_emails")
          .update({ scheduled_for: t.toISOString() })
          .eq("id", e.id);
      }
      } // end for (const e of campaignSchedules)
      return campResults;
    }; // end _processCampaignSchedules

    // Launch ALL campaigns in parallel (not one at a time)
    const _campPromises = [...$].map(([cid, scheds]) => {
      console.log(`[PARALLEL] Launching campaign ${cid} with ${scheds.length} schedule(s)`);
      return _processCampaignSchedules(scheds);
    });
    const _settled = await Promise.allSettled(_campPromises);
    for (const _r of _settled) {
      if (_r.status === 'fulfilled' && _r.value) z.push(..._r.value);
      else if (_r.status === 'rejected') console.error('[PARALLEL ERROR]', _r.reason);
    }
    
    // Close all SMTP connections in the pool gracefully
    for (const transporter of smtpPool.values()) {
      transporter.close();
    }
    console.log(`[SMTP POOL] Gracefully closed ${smtpPool.size} active SMTP connections.`);
    return JSON.stringify({ success: !0, processed: z });
  } catch (n) {
    return JSON.stringify({ success: false, error: String(n?.message ?? n) });
  }
}
