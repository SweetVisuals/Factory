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
 * Compresses scraped raw text by removing repetitive boilerplate, whitespace, and noise
 * to minimize input tokens sent to the LLM.
 */
function cleanScrapedNoise(text) {
  if (!text) return '';
  return text
    .replace(/(cookie policy|privacy policy|terms of service|all rights reserved|agree to our cookies)/gi, '')
    .replace(/\s+/g, ' ')
    .substring(0, 3500); // Cap at 3,500 characters to keep input tokens low (~800 tokens)
}

/**
 * Build the token-optimized deep research AI prompt.
 */
function buildResearchPrompt(companyName, rawWebsite, scrapedReport, campaignPitch, lead) {
  const pitchContext = campaignPitch ? `Campaign Pitch: ${campaignPitch}\n` : '';
  const leadContext = [
    lead.industry ? `Ind: ${lead.industry}` : '',
    lead.location ? `Loc: ${lead.location}` : '',
    lead.title ? `Title: ${lead.title}` : '',
  ].filter(Boolean).join(', ');

  const optimizedScraped = cleanScrapedNoise(scrapedReport);

  return `Extract business intelligence for "${companyName}" (${rawWebsite}) from the scraped text below.
${pitchContext}Known: ${leadContext}

TEXT:
${optimizedScraped}

CRITICAL INSTRUCTIONS:
1. You MUST populate ALL fields in the JSON. Do not leave them null or empty unless absolutely impossible.
2. If direct data is missing from the text, make highly educated logical deductions based on the company's niche/type (e.g., local estate agents usually have WordPress, Google Analytics; target market is local property owners/buyers; company size is typically 1-10; services offered are residential sales/lettings).
3. A maximum of 2 fields in total may be left empty/null/empty arrays. All other fields must be filled with factual data or logical deductions.

Output JSON ONLY (no markdown blocks):
{
  "company_description": "2-3 short sentences summarizing their business & focus.",
  "services_offered": ["service1", "service2"],
  "key_people": [{"name": "Name", "title": "Title", "linkedin": "URL or null"}],
  "pain_points": [{"area": "Area", "description": "Challenge details", "severity": "high|medium|low"}],
  "growth_signals": [{"type": "hiring|expansion|award", "detail": "Details"}],
  "target_market": "Target audience",
  "competitive_advantage": "Main differentiator",
  "company_size": "Employee count range or null",
  "year_founded": "Year or null",
  "annual_revenue": "Revenue or null",
  "tech_stack": ["tech1", "tech2"],
  "social_presence": {"google_rating": 4.5, "review_count": 100, "facebook_url": "url", "instagram_url": "url", "twitter_url": "url", "linkedin_url": "url"},
  "recent_news": [{"headline": "Title", "date": "date"}],
  "personalised_detail": "5-12 words referencing a specific project/service seen in text. Default: 'work'.",
  "quick_fact": "1 verified sentence from text."
}`;
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
        max_tokens: 700
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
