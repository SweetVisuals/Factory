/**
 * Rule-Based Email Template Engine
 * 
 * Generates personalised cold emails WITHOUT any AI API calls.
 * Uses deterministic template selection based on lead ID hash for reproducibility.
 * 
 * Reads: business overview, email tones, campaign niche/objective, lead research
 * Outputs: { subject, body } for any sequence step
 * 
 * @module email_engine
 */

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Extract first name from a full name string, handling edge cases.
 */
export function extractFirstName(fullName) {
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

/**
 * Clean company name for use in email copy.
 */
export function cleanCompanyName(company) {
  if (!company) return '';
  return company
    // Strip location suffixes: "Company — Leeds", "Company - London"
    .replace(/\s*[-–—]\s*(?:Leeds|London|Glasgow|Edinburgh|Birmingham|Manchester|Liverpool|Bristol|Sheffield|Nottingham|Cardiff|Belfast|Coventry|Somerset|UK|England|Scotland|Wales|Property Management|Letting|Lettings|Sales\s*(?:&|and)\s*Lettings?|Residential|SALES ONLY).*$/i, '')
    // Strip service description suffixes: "Company - IT Support London", "Company - Web Design"
    .replace(/\s*[-–—]\s*(?:IT Support|Web Design|Digital Marketing|SEO|Software|Development|Consulting|Recruitment|Staffing|Accounting|Legal|Financial|Insurance|Medical|Dental|Healthcare|Roofing|Building|Construction|Plumbing|Electrical|Landscaping|Fencing|Paving)[\s\w]*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+(?:Ltd|Limited|PLC|LLP|Inc|LLC)\.?\s*$/i, '')
    .replace(/\s+(?:Sales\s*(?:&|and)\s*Lettings?)\s*$/i, '')
    .replace(/\s+(?:Formerly\s+.*)$/i, '')
    .trim();
}

/**
 * Clean location string to a usable city/region name.
 */
export function cleanLocation(location) {
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

/**
 * Shorten company name for subject lines.
 */
export function shortName(company) {
  if (!company) return '';
  if (company.length <= 30) return company;
  const truncated = company.substring(0, 30).replace(/\s+\S*$/, '');
  return truncated || company.substring(0, 30);
}

/**
 * Deterministic hash from string, returns a positive integer.
 */
function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Map campaign niche string to a category.
 */
function getNicheCategory(niche) {
  if (!niche) return 'generic';
  const n = niche.toLowerCase();
  const tradesKw = ['roof', 'build', 'construct', 'landscape', 'groundwork', 'plumb', 'electric', 'hvac', 'plaster', 'contractor', 'trade', 'joiner', 'carpenter', 'painter', 'decorator', 'tiler', 'flooring', 'fencing', 'paving', 'demolition', 'scaffol'];
  const agencyKw = ['creative', 'web', 'tech', 'it ', 'digital', 'marketing', 'design', 'advertis', 'pr ', 'media', 'agency', 'agencies', 'branding', 'seo', 'software', 'dev', 'saas'];
  const proKw = ['account', 'legal', 'law', 'solicitor', 'dental', 'health', 'property', 'real estate', 'financial', 'insurance', 'mortgage', 'veterinary', 'optician', 'pharma', 'clinic'];

  if (tradesKw.some(kw => n.includes(kw))) return 'trades';
  if (agencyKw.some(kw => n.includes(kw))) return 'agencies';
  if (proKw.some(kw => n.includes(kw))) return 'professional';
  return 'generic';
}

/**
 * Build a readable niche label for use inside email copy.
 */
function nicheLabel(niche) {
  if (!niche) return 'businesses';
  const n = niche.toLowerCase();
  if (n.includes('roof')) return 'roofing firms';
  if (n.includes('build') || n.includes('construct')) return 'builders';
  if (n.includes('landscape') || n.includes('groundwork')) return 'landscapers';
  if (n.includes('plumb')) return 'plumbing firms';
  if (n.includes('electric')) return 'electrical firms';
  if (n.includes('plaster')) return 'plastering firms';
  if (n.includes('creative')) return 'creative agencies';
  if (n.includes('web') || n.includes('tech') || n.includes('it ')) return 'tech firms';
  if (n.includes('digital') || n.includes('marketing')) return 'marketing agencies';
  if (n.includes('design')) return 'design studios';
  if (n.includes('account')) return 'accounting firms';
  if (n.includes('legal') || n.includes('law') || n.includes('solicitor')) return 'law firms';
  if (n.includes('dental')) return 'dental practices';
  if (n.includes('property') || n.includes('real estate')) return 'property firms';
  return 'businesses';
}

/**
 * Detect if a name looks like a business name rather than a person's name.
 */
function isBusinessName(name) {
  if (!name) return true;
  const n = name.toLowerCase();
  const businessKeywords = ['ltd', 'limited', 'llc', 'inc', 'agency', 'digital', 'marketing', 'consulting', 'solutions', 'services', 'group', 'partners', 'associates', 'studio', 'entertainment', 'warehouse', 'management', 'technologies', 'designs', 'property', 'properties', 'real estate', 'clinic', 'dental', 'medical', 'events', 'roofing', 'building', 'construction', 'plumbing', 'electrical', 'landscaping', 'fencing', 'paving'];
  if (businessKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(n))) return true;
  if (n === 'the' || n.startsWith('the ') || n.startsWith('a ') || n.startsWith('an ')) return true;
  if (name.split(' ').length > 3) return true;
  if (name.length <= 1) return true;
  // ALL CAPS names are almost always company names
  if (name === name.toUpperCase() && name.length > 3) return true;
  // Contains commas — likely "CompanyName, Location"
  if (name.includes(',')) return true;
  return false;
}

/**
 * Build the smart greeting for a lead.
 * Returns { greeting, hasName } where greeting is the display name and hasName indicates if it's a real name.
 */
function buildGreeting(lead) {
  const name = (lead.name || '').trim();
  const company = cleanCompanyName(lead.company || '');

  if (name && !isBusinessName(name)) {
    const first = extractFirstName(name);
    if (first && first.length > 1) {
      return { greeting: first, hasName: true };
    }
  }

  // No usable person name — don't use company name as greeting in body 
  // (sounds weird: "Hi Acme Corp,"). Instead return empty, template will use "Hi there,"
  // But still pass company as context for subject lines
  return { greeting: '', hasName: false };
}

/**
 * Extract a relevant snippet from lead research summary for personalisation.
 */
function extractResearchSnippet(summary) {
  if (!summary) return 'work';
  
  // 1. Check for structured "## ⚡ Personalised Detail" section
  const detailMatch = summary.match(/##\s*⚡?\s*Personalised\s*Detail\s*\n+([^\n]+)/i);
  if (detailMatch && detailMatch[1]) {
    const detail = detailMatch[1].trim();
    if (detail && detail.toLowerCase() !== 'work' && detail.length < 90) {
      return detail.replace(/^the great\s+/i, '');
    }
  }

  // 2. Check for quick summary lines
  const quickMatch = summary.match(/##\s*⚡?\s*Quick\s*Summary\s*\n+([^\n]+)/i);
  if (quickMatch && quickMatch[1]) {
    const line = quickMatch[1].trim();
    if (line && !line.includes('N/A:') && line.length > 15) {
      return 'work';
    }
  }

  return 'work';
}

/**
 * Extract pain point and hook from business overview for a given niche.
 */
function extractBusinessContext(overviewMd, niche) {
  const result = { painPoint: '', hook: '', whatWeDo: '', advantage: '' };
  if (!overviewMd) return result;

  // Extract "What they do" section
  const whatMatch = overviewMd.match(/\*\*What they do:\*\*\s*(.+?)(?:\n\n|\*\*)/s);
  if (whatMatch) result.whatWeDo = whatMatch[1].trim().substring(0, 200);

  // Try to find niche-specific vertical section
  const nicheN = (niche || '').toLowerCase();
  const verticalRegex = /###\s*Vertical\s*\d+[:\s]*([^\n]+)\n([\s\S]*?)(?=###|---|\n##|$)/gi;
  let match;
  while ((match = verticalRegex.exec(overviewMd)) !== null) {
    const title = match[1].toLowerCase();
    const body = match[2];

    // Check if this vertical matches our niche
    const matches = (
      (nicheN.includes('roof') && title.includes('roof')) ||
      (nicheN.includes('build') && (title.includes('build') || title.includes('construct'))) ||
      (nicheN.includes('landscape') && (title.includes('landscape') || title.includes('ground'))) ||
      (nicheN.includes('plaster') && title.includes('plaster')) ||
      (nicheN.includes('plumb') && title.includes('plumb')) ||
      (nicheN.includes('electric') && title.includes('electric'))
    );

    if (matches) {
      const painMatch = body.match(/\*\*Pain point:\*\*\s*(.+?)(?:\n|$)/i);
      if (painMatch) result.painPoint = painMatch[1].trim();

      const hookMatch = body.match(/\*\*Hook:\*\*\s*(.+?)(?:\n|$)/i);
      if (hookMatch) result.hook = hookMatch[1].trim();

      const phraseMatch = body.match(/\*\*Key phrase to use:\*\*\s*(.+?)(?:\n|$)/i);
      if (phraseMatch) result.advantage = phraseMatch[1].trim().replace(/"/g, '');
      break;
    }
  }

  // Extract a competitive advantage if not found in vertical
  if (!result.advantage) {
    const advMatch = overviewMd.match(/\| \*\*([^|]+)\*\* \| "([^"]+)"/);
    if (advMatch) result.advantage = advMatch[2].trim();
  }

  return result;
}


// ─── Template Pools ─────────────────────────────────────────────────────────
// Each template is a function: (g, cn, sn, loc, hn, nl, pain, hook, research) => ({ subject, body })
// g = greeting, cn = company name, sn = short name, loc = location, hn = hasName
// nl = niche label, pain = pain point, hook = hook, research = research snippet

const TRADES_STEP0 = [
  (g, cn, sn, loc, hn, nl, pain, hook, res) => {
    const detail = (res && res.toLowerCase() !== 'work') ? res : 'work';
    const greetingLine = g ? `Hi ${g},` : `Hi there,`;
    const subjectName = g ? g : sn;
    const cleanDetail = detail.charAt(0).toUpperCase() + detail.slice(1);
    
    return {
      subject: `${cleanDetail}, ${subjectName}`,
      body: `${greetingLine}

I hope business is booming! I've done some digging and seen the great ${detail} you put out there, you're clearly talented at what you do. But I bet you hate all the admin (like this) that goes with it!

I'm Nicolas Theato, founder of Relay Solutions. We build automation that saves tradespeople time on admin — emails, booking and quoting jobs, invoices, even the Google searches to find new business — and gives that time back to you for the actual job.

Our software runs in the background doing all of it automatically. Emails answered, quotes sent, invoices posted, leads gathered with AI and listed ready for you to act on. It's like a little genie handling it all while you get on with your business.

We do a free audit to see where you're currently bogged down — costs you nothing. Think about how much business (and sanity) admin is costing you right now, versus just letting Relay handle it in the background without ever forgetting anything.

Reply to this email or WhatsApp me and I'll get the ball rolling with a quick demo.

Automation is the future — Relay is how I can get you there. Can't wait to chat.

Best wishes,

Nicolas Kai Theato
Founder, Relay Solutions
+44 7864 851184`
    };
  }
];

const TRADES_STEP1 = [
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: that question`,
    body: `Hi ${g || 'there'},\n\nSent a note last week about how ${nl} handle job admin. The ones who've sorted it out usually have some form of automated quoting that does the heavy lifting. Not a massive system — just enough to stop the evening spreadsheet sessions.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `numbers that surprised me`,
    body: `Hi ${g || 'there'},\n\nA couple of ${nl} in ${loc} tracked their lost enquiries last quarter. The ones going unanswered during busy site days were adding up to thousands in missed work. Has anyone done that exercise at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `following up`,
    body: `Hi ${g || 'there'},\n\nDropped you a line recently about the admin grind. One thing worth knowing — the ${nl} saving the most time aren't using expensive software. They've got simple tools that auto-capture enquiries and generate estimates. Takes the evening work off the table.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `quick follow up`,
    body: `Hi ${g || 'there'},\n\nJust circling back. The reason I asked about job admin at ${sn} is that most ${nl} I work with in ${loc} have the same bottleneck — they can do the work, but the quoting and follow-up is where they lose time and money.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `the bit nobody talks about`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} focus on getting more leads, but the real gap is usually in what happens after the enquiry comes in. Slow responses and manual quotes cost more than people think. Is that something you've noticed at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `worth knowing`,
    body: `Hi ${g || 'there'},\n\nA ${nl.replace(/s$/, '')} I spoke to in ${loc} last month said they'd been losing 3-4 jobs a week just from slow follow-up. Sorted it in a couple of weeks with a simple automated system. Thought it might be relevant for ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nFollowing up on my note about how ${nl} handle their quoting and follow-ups. The firms doing well right now have cut the manual admin down to near zero. Not with big software — with small, purpose-built tools that just handle the grunt work.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `something most ${nl} miss`,
    body: `Hi ${g || 'there'},\n\nThe hidden cost for most ${nl} in ${loc} isn't materials or labour — it's the time spent on admin that doesn't directly earn money. Evening quotes, chasing customers, updating spreadsheets. Does that ring true for ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `${loc} trade insight`,
    body: `Hi ${g || 'there'},\n\nQuick stat from the ${nl} I work with: the ones who automated their quoting process saw response times drop from 2-3 days to under an hour. That alone brought in more repeat work. Something worth thinking about for ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `the evening grind`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} I know spend their evenings writing quotes, and I'm fairly sure it's no different at ${sn}. The firms that fixed this didn't do anything complicated — they just put a simple system in place that handles it during work hours.`
  }),
];

const TRADES_STEP2 = [
  (g, cn, sn, loc, hn, nl) => ({
    subject: `10 minutes this week?`,
    body: `Hi ${g || 'there'},\n\nHappy to show you what some ${nl} in ${loc} are using to handle the quoting and follow-up admin automatically. 10 minutes, no sales pitch — just a quick look. Reply if you're open to it.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `worth a quick look?`,
    body: `Hi ${g || 'there'},\n\nWe've built tools for ${nl} that cut job admin time in half. Could show you how it works in a brief call — no obligation, just a demo. Interested?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: automating the admin`,
    body: `Hi ${g || 'there'},\n\nIf you're curious how other ${nl} in ${loc} have got rid of the evening quoting sessions, happy to walk you through it. Quick 10-minute call. Just reply.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `${sn.toLowerCase()} — quick demo?`,
    body: `Hi ${g || 'there'},\n\nWe've helped several ${nl} automate the bits that eat up their evenings. I could show you an example that's similar to ${sn}'s setup — takes 10 minutes. Reply if that's useful.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `brief call?`,
    body: `Hi ${g || 'there'},\n\nI'd love to show you what we've put together for ${nl} like ${sn}. No pressure — just a quick look at how the quoting and follow-up process can run without manual effort. Reply if you want to see it.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `how we help ${nl}`,
    body: `Hi ${g || 'there'},\n\nWe build simple automation tools for ${nl} — handling quotes, enquiry responses, and follow-ups without manual input. Could show you how it applies to ${sn}. Just reply if interested.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `quick call this week?`,
    body: `Hi ${g || 'there'},\n\nI've built systems that take the quoting and admin work off the plate for ${nl} in ${loc}. Want to see a 10-minute demo? No pitch — just showing you what's possible.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `free audit for ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nI'd like to do a quick free audit of where ${sn} could save time on admin and quoting. No cost, no strings — just a look at what could be automated. Reply if you're up for it.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `10 min — worth it?`,
    body: `Hi ${g || 'there'},\n\nIf ${sn} is spending more than a couple hours a week on manual quotes and follow-ups, I can probably show you how to get that back. 10-minute call — reply if that works.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: saving time at ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nWe've helped other ${nl} in ${loc} cut their admin time significantly with some simple tools. Happy to do a quick, no-obligation audit for ${sn}. Just reply to this email.`
  }),
];

const TRADES_STEP3 = [
  (g, cn, sn, loc, hn, nl) => ({
    subject: `not just ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nWe've had this same conversation with several ${nl} in ${loc} this month. It's a shared challenge — you're not alone in dealing with the admin overload.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `a common theme`,
    body: `Hi ${g || 'there'},\n\nJust to let you know — several other ${nl} around ${loc} have told us the exact same thing recently. The quoting and follow-up grind seems to be universal right now.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `${loc} ${nl} update`,
    body: `Hi ${g || 'there'},\n\nWe've been helping a few ${nl} nearby automate their admin this quarter. The results have been solid — thought you'd want to know it's a proven approach for firms like ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: ${nl} in ${loc.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nA couple of other ${nl} in your area took us up on the free audit recently. Thought ${sn} might benefit from the same look. Still open if you're interested.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `what others are doing`,
    body: `Hi ${g || 'there'},\n\nThe ${nl} who sorted their admin out first are now winning more jobs because they respond faster. It's becoming a competitive edge. Thought ${sn} should know.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `familiar story`,
    body: `Hi ${g || 'there'},\n\nSeveral ${nl} in ${loc} have described this exact same admin problem to us recently. Seems common across the industry right now. The offer to help ${sn} stands.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `in case it helps`,
    body: `Hi ${g || 'there'},\n\nOne of the ${nl} we worked with recently said they saved about 10 hours a week after automating their job admin. If that number sounds appealing for ${sn}, the offer for a free look is still open.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `thought you'd want to know`,
    body: `Hi ${g || 'there'},\n\nThe ${nl} around ${loc} who moved fastest on automating their quoting are now getting back to customers same-day. It's making a noticeable difference. Offer's still open for ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `industry trend`,
    body: `Hi ${g || 'there'},\n\nMore ${nl} in ${loc} are automating their job admin this year than ever before. The ones doing it early are gaining ground. Happy to show ${sn} what that looks like if you're curious.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: the admin problem`,
    body: `Hi ${g || 'there'},\n\nThe quoting and follow-up problem isn't unique to ${sn} — it's industry-wide for ${nl}. But the firms fixing it now are pulling ahead. Our free audit offer still stands.`
  }),
];

const TRADES_STEP4 = [
  (g, cn, sn, loc, hn, nl) => ({
    subject: `last one from me`,
    body: `Hi ${g || 'there'},\n\nI'll stop here. If the timing's ever right, the offer stands — no expiry. All the best with ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `wrapping up`,
    body: `Hi ${g || 'there'},\n\nThis'll be my last note. If things change or the admin grind gets too much, you know where I am. Good luck with ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `closing this off`,
    body: `Hi ${g || 'there'},\n\nNo more emails from me on this. If it ever becomes relevant, just reply to this thread — happy to pick it back up anytime.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `one last thing`,
    body: `Hi ${g || 'there'},\n\nI'll leave it at this. No pressure, no follow-up needed. If ${sn} ever needs help with the admin side, just give me a shout.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `all good`,
    body: `Hi ${g || 'there'},\n\nTiming might just not be right, and that's fine. Wishing ${sn} a solid rest of the year. Door's always open if things change.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `no hard feelings`,
    body: `Hi ${g || 'there'},\n\nLast message from me — promise. If ${sn} ever wants to look at automating the admin, just reply. No expiry on the offer.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `final note`,
    body: `Hi ${g || 'there'},\n\nI won't keep emailing. If it's useful down the line, reach out anytime. Best of luck with the busy season at ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `that's me done`,
    body: `Hi ${g || 'there'},\n\nLast one. Hope you're having a good run at ${sn}. If the admin ever gets too much, you've got my email. Take care.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `signing off`,
    body: `Hi ${g || 'there'},\n\nI'll park this. If you ever want a quick look at how to cut the paperwork, just reply. No rush, no pressure.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `over and out`,
    body: `Hi ${g || 'there'},\n\nI'll leave you to it. If the timing's right down the road, I'm here. All the best with ${sn}.`
  }),
];

// ─── AGENCY Templates ────────────────────────────────────────────────────────

const AGENCY_STEP0 = [
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `how you handle follow-ups`,
    body: `Hi ${g || 'there'},\n\n${res ? `Had a look at ${sn} — ${res.substring(0, 60).toLowerCase()}. ` : ''}One thing that comes up again and again with ${nl} is how manual the follow-up process still is. Is that the case for you?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: hn ? `${g.toLowerCase()} — quick one` : `quick one for ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nA lot of ${nl} I speak with are great at the creative work but still spending hours a week on proposals, client chasing, and lead follow-up. Wondering if that sounds like ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `how are you keeping up`,
    body: `Hi ${g || 'there'},\n\n${nl} owners tell me follow-ups are the first thing to slip when work gets busy. If you've got a system that handles it, fair play — but if not, I've got some ideas.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `${sn.toLowerCase()} — genuine question`,
    body: `Hi ${g || 'there'},\n\nCurious — when a lead comes in to ${sn}, what happens if nobody responds within 2 hours? In my experience with ${nl}, that's when most of them move on.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `leads going cold`,
    body: `Hi ${g || 'there'},\n\n${res ? `Noticed ${sn} — ${res.substring(0, 50).toLowerCase()}. ` : ''}Most ${nl} I talk to are losing leads not because the work isn't good, but because the response time is too slow. Sound familiar?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `the proposal bottleneck`,
    body: `Hi ${g || 'there'},\n\nThe biggest time drain I hear from ${nl} isn't client work — it's the proposals, briefs, and follow-up chasing that happen around it. How do you handle that at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `something I keep seeing`,
    body: `Hi ${g || 'there'},\n\nI keep seeing the same pattern with ${nl}: excellent creative output, but the sales pipeline and follow-up still runs on spreadsheets and memory. That true at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: hn ? `for ${g.toLowerCase()}` : `for the team at ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} I work with have amazing portfolios but lose momentum between that first enquiry and closing the deal. Curious how ${sn} manages that gap.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `the admin side of agency life`,
    body: `Hi ${g || 'there'},\n\nRunning a ${nl.replace(/s$/, '')} usually means being brilliant at creative work and average at admin. The follow-up, proposal writing, and client chasing tends to suffer. How's that at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `${nl} question`,
    body: `Hi ${g || 'there'},\n\nWhen ${sn} gets busy with client projects, what happens to new leads that come in? Most ${nl} I know admit those leads just wait — and waiting kills conversion rates.`
  }),
];

const AGENCY_STEP1 = [
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: follow-ups`,
    body: `Hi ${g || 'there'},\n\nSent a note recently about how ${nl} handle lead follow-up. The pattern I see is simple: the agencies closing the most deals aren't working harder — they've just automated the admin bits that slow them down.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `the hidden cost`,
    body: `Hi ${g || 'there'},\n\nThis kind of thing rarely shows up on a spreadsheet, but slow lead response is usually one of the biggest silent revenue leaks for busy ${nl}. Worth thinking about for ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `numbers worth knowing`,
    body: `Hi ${g || 'there'},\n\nIf even a handful of enquiries a month go unanswered or get slow responses, that's usually thousands in lost clients by year end. Has anyone worked that out at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `what fast-growing ${nl} do differently`,
    body: `Hi ${g || 'there'},\n\nThe ${nl} growing fastest right now aren't spending more on marketing — they're converting more of what comes in. The difference is usually how fast and consistently they follow up. Something to consider for ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: my last note`,
    body: `Hi ${g || 'there'},\n\nJust following up on my question about lead follow-up at ${sn}. The agencies that sort this out first tend to win work that used to go to competitors. It's not about being bigger — it's about being faster.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `agency insight`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} I work with were surprised to learn how many leads they were losing to slow response times. The fix wasn't complicated — just a system that handles the initial response and follow-up automatically.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `the response time gap`,
    body: `Hi ${g || 'there'},\n\nStudies show leads contacted within an hour are 7x more likely to convert. Most ${nl} take 2-3 days. That gap alone is worth a lot of revenue. Has ${sn} looked into this?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nCircling back on my note about ${nl} follow-up. The difference between winning and losing a client often comes down to who responds first. The agencies automating this are pulling ahead.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `something that might help`,
    body: `Hi ${g || 'there'},\n\nOne ${nl.replace(/s$/, '')} I worked with went from losing 3-4 leads per week to converting most of them — just by automating their initial response and proposal follow-up. Thought it might be relevant for ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `the proposal problem`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} spend 3-5 hours per proposal, then never follow up properly. The result is a lot of wasted effort. The firms that fixed this saw their close rate jump significantly. Relevant for ${sn}?`
  }),
];

const AGENCY_STEP2 = [
  (g, cn, sn, loc, hn, nl) => ({
    subject: `quick demo?`,
    body: `Hi ${g || 'there'},\n\nWe build follow-up and lead response tools specifically for ${nl}. Happy to show you what that looks like for ${sn} — 10 minutes, no pitch. Reply if interested.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `how we help ${nl}`,
    body: `Hi ${g || 'there'},\n\nWe set up automated systems that handle enquiries and follow-ups without manual effort. Could be a good fit for ${sn}. Want to see a quick example?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `10 minutes?`,
    body: `Hi ${g || 'there'},\n\nI'd like to show ${sn} how other ${nl} have automated their lead follow-up and proposal process. Quick 10-minute call — no sales pitch. Just reply.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `${sn.toLowerCase()} — free audit`,
    body: `Hi ${g || 'there'},\n\nHappy to do a free audit of ${sn}'s lead response process. No cost, no obligation — just a look at where automation could save you time. Reply if you're curious.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `how this gets solved`,
    body: `Hi ${g || 'there'},\n\nWe build systems that take care of enquiries and follow-ups without manual input, so nothing slips through. Happy to show you an example relevant to ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `how we can take this off your plate`,
    body: `Hi ${g || 'there'},\n\nWe build automated tools that pick up and follow up on enquiries without anyone needing to manage it manually. Could be worth exploring for ${sn}. Reply if interested.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `re: automating follow-up`,
    body: `Hi ${g || 'there'},\n\nIf ${sn} is losing leads to slow response times, we can fix that with a simple automated system. Takes 10 minutes to show you how. Reply if you want a quick look.`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `worth 10 minutes?`,
    body: `Hi ${g || 'there'},\n\nWe help ${nl} automate the parts of client acquisition that don't need a human touch — the follow-ups, reminders, and initial responses. Want to see how it could work for ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `a quick look`,
    body: `Hi ${g || 'there'},\n\nI can show you exactly how we'd set up an automated lead response system for ${sn}. No commitment — just a brief demo. Interested?`
  }),
  (g, cn, sn, loc, hn, nl) => ({
    subject: `custom solution for ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nWe don't do one-size-fits-all. We'd build something tailored to how ${sn} actually works. Want to see what that might look like? Just reply.`
  }),
];

const AGENCY_STEP3 = TRADES_STEP3; // Reuse social proof templates — they're generic enough
const AGENCY_STEP4 = TRADES_STEP4; // Reuse breakup templates

// ─── PROFESSIONAL Templates ─────────────────────────────────────────────────
// Slightly more formal but still human

const PROFESSIONAL_STEP0 = [
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: hn ? `${g.toLowerCase()} — quick question` : `quick question for ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\n${res ? `I was looking at ${sn} — ${res.substring(0, 60).toLowerCase()}. ` : ''}Most ${nl} I speak to are still losing hours a week to manual client chasing and document follow-ups. Is that the case at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `${loc} ${nl} question`,
    body: `Hi ${g || 'there'},\n\nCurious — how much time does your team at ${sn} spend chasing clients for documents and information each month? Most ${nl} in ${loc} I've spoken with are surprised how much of that can run on autopilot.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `scaling ${sn.toLowerCase()} without hiring`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} in ${loc} hit the same ceiling — more clients means more admin, and hiring to keep up eats into margins. How are you handling growth at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `the admin side`,
    body: `Hi ${g || 'there'},\n\nA lot of ${nl} in ${loc} are still running on manual emails and spreadsheets for client reminders, document tracking, and deadline management. That the case at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `${sn.toLowerCase()} — quick thought`,
    body: `Hi ${g || 'there'},\n\nThe ${nl} I work with around ${loc} all say the same thing: they're great at the actual professional work, but the client admin is a constant drain. How's that at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `client follow-up question`,
    body: `Hi ${g || 'there'},\n\nWhat happens at ${sn} when a client hasn't sent their documents back after a week? Most ${nl} I know rely on manual reminders — which means things get missed when it's busy.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: hn ? `for ${g.toLowerCase()} at ${sn.toLowerCase()}` : `for the team at ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nI work with ${nl} around ${loc}. Most are burning hours on admin that could easily be automated — client reminders, document workflows, deadline tracking. Sound familiar at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `less admin, more capacity`,
    body: `Hi ${g || 'there'},\n\nThe ${nl} managing more clients without adding headcount usually have one thing in common: they automated the repetitive admin. Curious if ${sn} has explored that at all.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `the capacity question`,
    body: `Hi ${g || 'there'},\n\nIf ${sn} wanted to take on 20% more clients next quarter, could your current admin processes handle it? Most ${nl} in ${loc} tell me honestly — probably not.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `automating the grunt work`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} in ${loc} tell me that client follow-ups and manual document collection are the biggest drains on their time. Is that the same story at ${sn}?`
  }),
];

const PROFESSIONAL_STEP1 = TRADES_STEP1; // Reuse with niche label handling
const PROFESSIONAL_STEP2 = TRADES_STEP2; 
const PROFESSIONAL_STEP3 = TRADES_STEP3;
const PROFESSIONAL_STEP4 = TRADES_STEP4;

// ─── GENERIC Templates (catch-all) ──────────────────────────────────────────

const GENERIC_STEP0 = [
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: hn ? `${g.toLowerCase()} — quick question` : `quick question for ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\n${res ? `Had a look at ${sn} — ${res.substring(0, 60).toLowerCase()}. ` : ''}Most ${nl} I speak to are still handling a lot of admin manually. Curious how ${sn} handles that side of things.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `how you handle the admin`,
    body: `Hi ${g || 'there'},\n\nI keep hearing from ${nl} that the operational side — follow-ups, scheduling, client comms — takes up more time than the actual work. True at ${sn} too?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `${sn.toLowerCase()} question`,
    body: `Hi ${g || 'there'},\n\nWhen work gets busy at ${sn}, what's the first thing that slips? For most ${nl} I talk to, it's the follow-up and admin. That ring true?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `one thing I keep hearing`,
    body: `Hi ${g || 'there'},\n\nThe ${nl} I work with all say the same thing: the work itself is great, but the admin around it is killing their time. Curious if that's the case at ${sn}.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `honest question`,
    body: `Hi ${g || 'there'},\n\nIs your team at ${sn} spending more time on admin and follow-ups than you'd like? Most ${nl} I talk to are — and most don't realise how fixable it is.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `the admin problem`,
    body: `Hi ${g || 'there'},\n\nI work with ${nl} and the number one complaint is always the same: too much time on admin, not enough on the actual work. How's that balance at ${sn}?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: hn ? `${g.toLowerCase()}, quick thought` : `quick thought for ${sn.toLowerCase()}`,
    body: `Hi ${g || 'there'},\n\nMost ${nl} I speak with have solid work coming in but struggle with the admin — scheduling, follow-ups, client updates. Is that a pain point at ${sn} or have you sorted it?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `how ${nl} are saving time`,
    body: `Hi ${g || 'there'},\n\nA lot of ${nl} are cutting their admin time in half this year. Not with big expensive software — with simple, tailored automation. Curious if ${sn} has explored that.`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `${nl} insight`,
    body: `Hi ${g || 'there'},\n\nI've been having the same conversation with ${nl} recently: great at what they do, drowning in admin. Is that ${sn}'s story too, or have you cracked it?`
  }),
  (g, cn, sn, loc, hn, nl, pain, hook, res) => ({
    subject: `re: manual work`,
    body: `Hi ${g || 'there'},\n\nHow much of the day-to-day at ${sn} is still run manually? Follow-ups, scheduling, client comms? Most ${nl} I know are surprised how much of it can be automated.`
  }),
];

const GENERIC_STEP1 = TRADES_STEP1;
const GENERIC_STEP2 = TRADES_STEP2;
const GENERIC_STEP3 = TRADES_STEP3;
const GENERIC_STEP4 = TRADES_STEP4;

// ─── Template Pool Map ──────────────────────────────────────────────────────

const TEMPLATE_POOLS = {
  trades:       [TRADES_STEP0, TRADES_STEP1, TRADES_STEP2, TRADES_STEP3, TRADES_STEP4],
  agencies:     [AGENCY_STEP0, AGENCY_STEP1, AGENCY_STEP2, AGENCY_STEP3, AGENCY_STEP4],
  professional: [PROFESSIONAL_STEP0, PROFESSIONAL_STEP1, PROFESSIONAL_STEP2, PROFESSIONAL_STEP3, PROFESSIONAL_STEP4],
  generic:      [GENERIC_STEP0, GENERIC_STEP1, GENERIC_STEP2, GENERIC_STEP3, GENERIC_STEP4],
};


// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate a personalised cold email for a lead.
 * 
 * @param {Object} params
 * @param {Object} params.lead - Lead data (id, email, name, company, website, location, industry, summary)
 * @param {Object} params.campaign - Campaign data (niche, objective, name)
 * @param {Object} [params.business] - Business data (overview_md, name, signature_template)
 * @param {Object} [params.emailTone] - Email tone data (content_md)
 * @param {number} params.stepIndex - 0-based step index in the sequence
 * @param {number} params.totalSteps - Total steps in the sequence
 * @param {Object} [params.senderAccount] - Sender email account data (name, email, company)
 * @returns {{ subject: string, body: string }}
 */
export function generateEmail({ lead, campaign, business, emailTone, stepIndex, totalSteps, senderAccount }) {
  // ── Build context
  const { greeting, hasName } = buildGreeting(lead);
  const company = cleanCompanyName(lead.company || '');
  const sn = shortName(company) || 'your business';
  const loc = cleanLocation(lead.location);
  const nl = nicheLabel(campaign?.niche);
  const category = getNicheCategory(campaign?.niche);
  const research = extractResearchSnippet(lead.summary);

  // ── Extract business context
  const bizCtx = extractBusinessContext(business?.overview_md, campaign?.niche);

  // ── Clamp step index to available pools
  const pools = TEMPLATE_POOLS[category] || TEMPLATE_POOLS.generic;
  const clampedStep = Math.min(stepIndex, pools.length - 1);
  const pool = pools[clampedStep];

  // ── Deterministic template selection based on lead ID + step
  const hashInput = (lead.id || lead.email || '') + '_step' + stepIndex;
  const idx = hashStr(hashInput) % pool.length;
  const templateFn = pool[idx];

  // ── Generate email
  const result = templateFn(
    greeting || '',
    company || sn,
    sn,
    loc,
    hasName,
    nl,
    bizCtx.painPoint,
    bizCtx.hook,
    research
  );

  // ── Clean up body — ensure it starts with "Hi " greeting
  let body = result.body;
  // If greeting was empty, fix "Hi ," to "Hi there,"
  if (!greeting) {
    body = body.replace(/^Hi\s*,/i, 'Hi there,');
  }

  // ── Clean subject — ensure lowercase feel, no trailing punctuation
  let subject = result.subject;
  subject = subject.replace(/[!.]$/, '').trim();

  return { subject, body };
}

/**
 * Generate all sequence steps for a lead (for preview purposes).
 */
export function generateAllSteps({ lead, campaign, business, emailTone, totalSteps, senderAccount }) {
  const steps = [];
  const numSteps = totalSteps || 5;
  for (let i = 0; i < numSteps; i++) {
    steps.push({
      step: i + 1,
      ...generateEmail({ lead, campaign, business, emailTone, stepIndex: i, totalSteps: numSteps, senderAccount })
    });
  }
  return steps;
}
