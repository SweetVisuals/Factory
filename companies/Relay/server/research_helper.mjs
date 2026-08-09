import { performDeterministicResearch } from './scraper_tools.mjs';
import { executionQueue } from './execution_queue.mjs';
import { fetchCrawl4AI } from './scraper.mjs';
import { fetchAIChatCompletion } from './ai-client.mjs';
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
 * Unified deep research function that:
 * 1. Scrapes the company website using Crawl4AI (token-efficient markdown)
 * 2. Uses AI to extract verified insights and pain points from the clean markdown.
 * 3. Falls back to deterministic extraction if AI fails.
 */
export async function researchAndSummarizeLead(lead, log = console.log, campaignPitch = '') {
  return executionQueue.enqueue(async () => {
    const companyName = lead.company || lead.name || 'Unknown Company';
    const rawWebsite = lead.website || '';
    const normalizedWebsite = normalizeUrl(rawWebsite);

    log(`[Research Helper] Starting AI deep research for ${companyName} (${rawWebsite})...`);

    let websiteContent = '';
    let usedCrawl4AI = false;
    let parsed = {};

    if (normalizedWebsite) {
      try {
        log(`[Research Helper] Scraping website: ${normalizedWebsite} (Crawl4AI)`);
        websiteContent = await fetchCrawl4AI(normalizedWebsite, log);
        if (websiteContent) {
           usedCrawl4AI = true;
           // Limit to 15,000 chars to be very token efficient (~3-4k tokens max)
           websiteContent = websiteContent.substring(0, 15000);
        }
      } catch (e) {
        log(`[Research Helper] Crawl4AI failed, falling back to Camoufox...`);
      }
      
      // Deterministic scrape to get basic JSON and socials/Google Maps info
      try {
        const scrapedJsonStr = await performDeterministicResearch(companyName, normalizedWebsite);
        parsed = JSON.parse(scrapedJsonStr) || {};
        if (!usedCrawl4AI) {
           websiteContent = `Extracted Text: ${JSON.stringify(parsed.website_data || parsed).substring(0, 10000)}`;
        }
      } catch(e) {}
    } else {
      log(`[Research Helper] No website URL provided for ${companyName}.`);
    }

    if (!websiteContent && !parsed.website_data) {
        return { summary: `ERROR: No website content found.`, score: 0, data: null, error: 'No website content found.' };
    }

    // Prepare token-efficient AI prompt
    const systemPrompt = `You are an expert sales researcher. You are researching a company named "${companyName}".
Extract verified information based ONLY on the provided website content and review snippets. 
Be harsh, realistic, and direct. Do not sugarcoat or exaggerate any findings. ONLY output verified facts.
Output a strict JSON object with the following keys:
- company_description: A clear, concise 2-3 sentence overview of what the company does.
- services_offered: Array of strings (max 5 core services).
- key_people: Array of strings (names and titles if found).
- pain_points: Array of objects { area: string, description: string, severity: 'high' | 'medium' }. Focus heavily on bad reviews or legacy indicators.
- growth_signals: Array of objects { type: string, detail: string }. E.g. hiring, expanding.
- tech_stack: Array of strings.
- target_market: String (who they sell to).
- competitive_advantage: String (what makes them unique).
- company_size: String (e.g. "Small", "10-50 employees").
- year_founded: String (if found).
- annual_revenue: String (if found).

Website Markdown Data (Truncated for efficiency):
${websiteContent}

Known Bad Reviews / External Data:
${JSON.stringify(parsed.bad_reviews || [])}
${JSON.stringify(parsed.pain_points || [])}
`;

    let aiParsed = {};
    try {
        const aiResponse = await fetchAIChatCompletion({
           messages: [{ role: 'system', content: systemPrompt }],
           temperature: 0.1,
           response_format: { type: 'json_object' },
           model: 'deepseek-v4-flash',
           max_tokens: 1500
        }, log);

        aiParsed = JSON.parse(aiResponse.choices[0].message.content);
        log(`[Research Helper] AI successfully extracted insights.`);
    } catch(e) {
        log(`[Research Helper] AI Extraction Failed: ${e.message}. Using deterministic fallback.`);
        aiParsed = {
           company_description: parsed.website_data?.description || '',
           services_offered: parsed.services || [],
           pain_points: parsed.pain_points || [],
           growth_signals: parsed.growth_signals || [],
           tech_stack: parsed.tech_stack || []
        };
    }

    const sanitized = {
        company_description: aiParsed.company_description || '',
        services_offered: aiParsed.services_offered || [],
        key_people: aiParsed.key_people || [],
        pain_points: [
            ...(aiParsed.pain_points || []),
            ...(parsed.bad_reviews || []).map(br => ({
                area: 'External Review Feedback',
                description: br,
                severity: 'high'
            }))
        ],
        growth_signals: aiParsed.growth_signals || [],
        target_market: aiParsed.target_market || '',
        competitive_advantage: aiParsed.competitive_advantage || '',
        company_size: aiParsed.company_size || '',
        year_founded: aiParsed.year_founded || '',
        annual_revenue: aiParsed.annual_revenue || '',
        tech_stack: aiParsed.tech_stack || [],
        social_presence: {
            google_rating: parsed.google_data?.rating ? parseFloat(parsed.google_data.rating) : null,
            review_count: parsed.google_data?.reviews ? parseInt(parsed.google_data.reviews.replace(/,/g, '')) : null,
            facebook_url: (parsed.website_data?.socials || []).find(s => typeof s === 'string' && s.includes('facebook')),
            instagram_url: (parsed.website_data?.socials || []).find(s => typeof s === 'string' && s.includes('instagram')),
            twitter_url: (parsed.website_data?.socials || []).find(s => typeof s === 'string' && s.includes('twitter')),
            linkedin_url: (parsed.website_data?.socials || []).find(s => typeof s === 'string' && s.includes('linkedin')) || parsed.linkedin_links?.[0],
        },
        recent_news: (parsed.news_snippets || []).map(n => ({ headline: n, date: null, source: 'Google News' })),
        // Include raw bad reviews on the top level for easy DB insertion later
        bad_reviews: parsed.bad_reviews || []
    };

    const score = calculateResearchScore(sanitized);
    
    let summaryFormatted = ``;
    
    if (sanitized.company_description) {
        summaryFormatted += `## 🏢 Company Overview\n${sanitized.company_description}\n\n`;
    }
    
    if (sanitized.pain_points && sanitized.pain_points.length > 0) {
        summaryFormatted += `## 🚨 Bleeding Business Signals (Pain Points & Reviews)\n`;
        sanitized.pain_points.forEach(p => {
            summaryFormatted += `- **${p.area}**: ${p.description}\n`;
        });
        summaryFormatted += `\n`;
    }
    
    if (sanitized.tech_stack && sanitized.tech_stack.length > 0) {
        summaryFormatted += `## 💻 Tech Stack\n- ${sanitized.tech_stack.join('\n- ')}\n\n`;
    }
    
    if (sanitized.social_presence && (sanitized.social_presence.google_rating || sanitized.social_presence.facebook_url)) {
        summaryFormatted += `## 🌐 Reputation & Social\n`;
        if (sanitized.social_presence.google_rating) {
            summaryFormatted += `- **Rating**: ${sanitized.social_presence.google_rating} Stars (${sanitized.social_presence.review_count || 0} reviews)\n`;
        }
        if (sanitized.social_presence.facebook_url) summaryFormatted += `- **Facebook**: Found\n`;
        if (sanitized.social_presence.instagram_url) summaryFormatted += `- **Instagram**: Found\n`;
        if (sanitized.social_presence.linkedin_url) summaryFormatted += `- **LinkedIn**: Found\n`;
        summaryFormatted += `\n`;
    }
    
    if (sanitized.recent_news && sanitized.recent_news.length > 0) {
        summaryFormatted += `## 📰 Recent News\n`;
        sanitized.recent_news.forEach(n => {
            summaryFormatted += `- ${n.headline}\n`;
        });
        summaryFormatted += `\n`;
    }

    log(`[Research Helper] ✅ Deterministic research completed. Score: ${score}/100.`);

    return {
      summary: summaryFormatted,
      status: 'completed',
      structured: sanitized,
      research_score: score,
      research_data_raw: scrapedJsonStr
    };
  }, 'researchAndSummarizeLead');
}

/**
 * Legacy wrapper to prevent API crash when called from older scraper code.
 */
export async function generateStructuredResearchFromText(aggregatedText, companyName, url, leadData, log, notesContext) {
  // Delegate to the new deterministic method
  return await researchAndSummarizeLead({ company: companyName, website: url }, log, '');
}

export class AIRateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIRateLimitError';
  }
}
