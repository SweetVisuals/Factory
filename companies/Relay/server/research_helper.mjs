import { fetchAIChatCompletion } from './ai-client.mjs';
import { performDeepResearch } from './scraper.mjs';
import { executionQueue } from './execution_queue.mjs';

/**
 * Custom error class for AI rate limit hits (HTTP 429 / groq model exhaustion).
 */
export class AIRateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIRateLimitError';
  }
}

/**
 * Normalizes a URL to ensure it starts with http:// or https://.
 */
function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Calculate a research quality score (0-100) based on populated fields.
 */
function calculateResearchScore(parsed) {
  let score = 0;
  const checks = [
    { field: 'company_description', weight: 15, test: v => v && v.length > 20 },
    { field: 'services_offered', weight: 10, test: v => Array.isArray(v) && v.length > 0 },
    { field: 'key_people', weight: 12, test: v => Array.isArray(v) && v.length > 0 },
    { field: 'pain_points', weight: 12, test: v => Array.isArray(v) && v.length > 0 },
    { field: 'growth_signals', weight: 8, test: v => Array.isArray(v) && v.length > 0 },
    { field: 'target_market', weight: 8, test: v => v && v.length > 5 },
    { field: 'competitive_advantage', weight: 8, test: v => v && v.length > 10 },
    { field: 'company_size', weight: 5, test: v => !!v },
    { field: 'year_founded', weight: 5, test: v => !!v },
    { field: 'annual_revenue', weight: 5, test: v => !!v },
    { field: 'tech_stack', weight: 4, test: v => Array.isArray(v) && v.length > 0 },
    { field: 'social_presence', weight: 4, test: v => v && (v.google_rating || v.review_count) },
    { field: 'recent_news', weight: 4, test: v => Array.isArray(v) && v.length > 0 },
  ];

  for (const check of checks) {
    if (check.test(parsed[check.field])) {
      score += check.weight;
    }
  }

  return Math.min(100, score);
}

/**
 * Build the comprehensive deep research AI prompt.
 */
function buildResearchPrompt(companyName, rawWebsite, scrapedReport, campaignPitch, lead) {
  const pitchContext = campaignPitch ? `\nCAMPAIGN OBJECTIVE / PITCH:\n${campaignPitch}\n` : '';
  const leadContext = [
    lead.industry ? `Industry: ${lead.industry}` : '',
    lead.location ? `Location: ${lead.location}` : '',
    lead.employees ? `Employees: ${lead.employees}` : '',
    lead.title ? `Contact Title: ${lead.title}` : '',
    lead.role ? `Contact Role: ${lead.role}` : '',
  ].filter(Boolean).join('\n');

  return `You are an elite business intelligence analyst. Your job is to extract MAXIMUM useful information from the scraped data below about "${companyName}" (${rawWebsite}).

${pitchContext}
KNOWN LEAD DATA:
${leadContext || 'None available'}

SCRAPED DATA:
${scrapedReport.substring(0, 8000)}

INSTRUCTIONS:
Analyze ALL the scraped data thoroughly. Extract every piece of useful business intelligence you can find. Do NOT hallucinate or invent information — only report what is evidenced in the data. If a field cannot be determined from the data, use null for strings/objects or empty arrays for lists.

Respond with ONLY valid JSON in this exact schema:
{
  "company_description": "2-4 sentence comprehensive overview of what the company does, their mission, and market position",
  "services_offered": ["service1", "service2", ...],
  "key_people": [{"name": "Full Name", "title": "Job Title", "linkedin": "linkedin URL or null"}],
  "pain_points": [{"area": "Area name", "description": "Why this is a pain point for them", "severity": "high|medium|low"}],
  "growth_signals": [{"type": "hiring|expansion|award|funding|new_product", "detail": "What the signal is", "date": "date if known or null"}],
  "target_market": "Who their customers/clients are",
  "competitive_advantage": "What differentiates them from competitors",
  "company_size": "Employee count or range (e.g. '11-50', '50-200') or null",
  "year_founded": "Year as string or null",
  "annual_revenue": "Revenue estimate/range or null",
  "tech_stack": ["technology1", "technology2", ...],
  "social_presence": {"google_rating": number_or_null, "review_count": number_or_null, "facebook_url": "url_or_null", "instagram_url": "url_or_null", "twitter_url": "url_or_null", "linkedin_url": "url_or_null"},
  "recent_news": [{"headline": "News item", "date": "date or null", "source": "source or null"}],
  "personalised_detail": "A specific 5-15 word observation about their work that shows you researched them. Must reference a REAL project, service, or achievement found in the data. If nothing specific found, use 'work'.",
  "quick_fact": "One verified sentence about the company from the data. If nothing found, use 'No specific details available.'"
}

CRITICAL RULES:
- Extract REAL data only. Never invent services, people, or facts.
- For pain_points: Infer business challenges from their industry, size, and services (e.g. a small estate agency likely struggles with manual property listings, tenant management overhead).
- For growth_signals: Look for mentions of hiring, new offices, awards, partnerships, new services.
- For key_people: Look in team pages, about pages, LinkedIn snippets. Include owners, directors, managers.
- For services_offered: Be specific, not generic. "Residential lettings" not just "property services".
- For tech_stack: Only if explicitly mentioned (e.g. "Powered by WordPress", "Built with React").
- social_presence google_rating should be a number like 4.5, not a string.`;
}

/**
 * Parse the AI response, with fallback handling for malformed JSON.
 */
function parseAIResponse(contentText, log) {
  // Try direct JSON parse
  try {
    return JSON.parse(contentText);
  } catch (e) {
    log(`[Research Helper] Direct JSON parse failed, attempting extraction...`);
  }

  // Try extracting JSON from markdown code blocks
  const jsonBlockMatch = contentText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch (e) {
      log(`[Research Helper] Code block JSON parse failed.`);
    }
  }

  // Try finding JSON object in the text
  const jsonObjMatch = contentText.match(/\{[\s\S]*\}/);
  if (jsonObjMatch) {
    try {
      return JSON.parse(jsonObjMatch[0]);
    } catch (e) {
      log(`[Research Helper] Extracted JSON parse failed.`);
    }
  }

  return null;
}

/**
 * Sanitize and validate parsed research data.
 */
function sanitizeResearchData(parsed) {
  const ensureArray = (val) => Array.isArray(val) ? val : [];
  const ensureString = (val) => (typeof val === 'string' && val.trim()) ? val.trim() : null;
  const ensureObject = (val) => (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};

  return {
    company_description: ensureString(parsed.company_description),
    services_offered: ensureArray(parsed.services_offered).filter(s => typeof s === 'string' && s.trim()).slice(0, 20),
    key_people: ensureArray(parsed.key_people).filter(p => p && p.name).map(p => ({
      name: String(p.name || '').trim(),
      title: String(p.title || '').trim(),
      linkedin: ensureString(p.linkedin)
    })).slice(0, 10),
    pain_points: ensureArray(parsed.pain_points).filter(p => p && p.area).map(p => ({
      area: String(p.area || '').trim(),
      description: String(p.description || '').trim(),
      severity: ['high', 'medium', 'low'].includes(p.severity) ? p.severity : 'medium'
    })).slice(0, 8),
    growth_signals: ensureArray(parsed.growth_signals).filter(g => g && g.detail).map(g => ({
      type: String(g.type || 'other').trim(),
      detail: String(g.detail || '').trim(),
      date: ensureString(g.date)
    })).slice(0, 10),
    target_market: ensureString(parsed.target_market),
    competitive_advantage: ensureString(parsed.competitive_advantage),
    company_size: ensureString(parsed.company_size),
    year_founded: ensureString(parsed.year_founded),
    annual_revenue: ensureString(parsed.annual_revenue),
    tech_stack: ensureArray(parsed.tech_stack).filter(t => typeof t === 'string' && t.trim()).slice(0, 15),
    social_presence: (() => {
      const sp = ensureObject(parsed.social_presence);
      return {
        google_rating: typeof sp.google_rating === 'number' ? sp.google_rating : null,
        review_count: typeof sp.review_count === 'number' ? sp.review_count : null,
        facebook_url: ensureString(sp.facebook_url),
        instagram_url: ensureString(sp.instagram_url),
        twitter_url: ensureString(sp.twitter_url),
        linkedin_url: ensureString(sp.linkedin_url),
      };
    })(),
    recent_news: ensureArray(parsed.recent_news).filter(n => n && n.headline).map(n => ({
      headline: String(n.headline || '').trim(),
      date: ensureString(n.date),
      source: ensureString(n.source)
    })).slice(0, 10),
    personalised_detail: ensureString(parsed.personalised_detail) || 'work',
    quick_fact: ensureString(parsed.quick_fact) || 'No specific details available.',
  };
}

/**
 * Unified deep research function that:
 * 1. Scrapes the company website (via performDeepResearch in scraper.mjs)
 * 2. Processes the data with DeepSeek via fetchAIChatCompletion using comprehensive extraction prompt.
 * 3. Returns structured research data with quality scoring.
 * 4. Preserves backward compatibility with old summary format.
 */
export async function researchAndSummarizeLead(lead, log = console.log, campaignPitch = '') {
  return executionQueue.enqueue(async () => {
    const companyName = lead.company || lead.name || 'Unknown Company';
    const rawWebsite = lead.website || '';
    const normalizedWebsite = normalizeUrl(rawWebsite);

    log(`[Research Helper] Starting deep research for ${companyName} (${rawWebsite})...`);

    let scrapedReport = '';
    if (normalizedWebsite) {
      try {
        log(`[Research Helper] Scraping website: ${normalizedWebsite}`);
        scrapedReport = await performDeepResearch(companyName, normalizedWebsite);
      } catch (e) {
        log(`[Research Helper] Website scraping failed: ${e.message}`);
        scrapedReport = `Failed to scrape website: ${e.message}`;
      }
    } else {
      log(`[Research Helper] No website URL provided for ${companyName}.`);
      scrapedReport = `No website URL provided.`;
    }

    const prompt = buildResearchPrompt(companyName, rawWebsite, scrapedReport, campaignPitch, lead);

    try {
      log(`[Research Helper] Calling DeepSeek AI for comprehensive analysis...`);
      const aiRes = await fetchAIChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 1500
      }, log);

      if (aiRes && aiRes.choices && aiRes.choices[0]) {
        const contentText = aiRes.choices[0].message.content;
        const parsed = parseAIResponse(contentText, log);

        if (!parsed) {
          log(`[Research Helper] ⚠️ Failed to parse AI response as JSON.`);
          return {
            summary: `## ⚡ Personalised Detail\nwork\n\n## 🔬 Quick Fact\nResearch data could not be parsed.`,
            status: 'error',
            structured: null,
            research_score: 0,
            research_data_raw: scrapedReport
          };
        }

        const sanitized = sanitizeResearchData(parsed);
        const score = calculateResearchScore(sanitized);

        // Build backward-compatible summary (still used for email personalisation)
        const detail = sanitized.personalised_detail;
        const fact = sanitized.quick_fact;
        const summaryFormatted = `## ⚡ Personalised Detail\n${detail}\n\n## 🔬 Quick Fact\n${fact}`;

        log(`[Research Helper] ✅ Deep research completed. Score: ${score}/100. Detail: "${detail}"`);

        return {
          summary: summaryFormatted,
          status: score >= 30 ? 'completed' : 'incomplete',
          structured: sanitized,
          research_score: score,
          research_data_raw: scrapedReport.substring(0, 50000) // cap raw data storage
        };
      } else {
        throw new Error('AI response structure invalid or empty.');
      }
    } catch (err) {
      const isRateLimit = err.message.toLowerCase().includes('rate limit') || 
                          err.message.toLowerCase().includes('429') || 
                          err.message.toLowerCase().includes('exhausted') ||
                          err.message.toLowerCase().includes('exceeded');
      if (isRateLimit) {
        log(`[Research Helper] 🚨 Rate limit detected: ${err.message}`);
        throw new AIRateLimitError(`AI rate limit hit: ${err.message}`);
      }
      throw err;
    }
  }, `research-lead-${lead.id || lead.email || 'unknown'}`);
}
