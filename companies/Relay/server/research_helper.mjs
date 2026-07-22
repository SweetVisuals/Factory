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
 * Unified research function that:
 * 1. Scrapes the company website (via performDeepResearch in scraper.mjs)
 * 2. Processes the data with Groq via fetchAIChatCompletion using a strict anti-hallucination prompt.
 * 3. Enforces that the summary is short, cold-call friendly, contains a key fact, and is 100% accurate.
 */
export async function researchAndSummarizeLead(lead, log = console.log, campaignPitch = '') {
  return executionQueue.enqueue(async () => {
    const companyName = lead.company || lead.name || 'Unknown Company';
    const rawWebsite = lead.website || '';
    const normalizedWebsite = normalizeUrl(rawWebsite);

    log(`[Research Helper] Starting research for ${companyName} (${rawWebsite})...`);

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

    const pitchContext = campaignPitch ? `
CAMPAIGN OBJECTIVE / PITCH:
${campaignPitch}

` : '';

    // Define strict anti-hallucination instructions per Outreach Email Guide
    const prompt = `You are an elite business intelligence researcher. Analyze the scraped text for ${companyName} (${rawWebsite}).

${pitchContext}Scraped Data:
${scrapedReport.substring(0, 3000)}

RULES (STRICT COMPLIANCE REQUIRED):
1. Look for ONE specific, real, completed project, service, or clear specialism mentioned in the scraped text that makes them a perfect fit for our CAMPAIGN OBJECTIVE.
2. Write a 5-12 word descriptive noun phrase for "[PERSONALISED DETAIL]" to drop into this sentence: "seen the great [PERSONALISED DETAIL] you put out there".
3. NEVER invent or hallucinate. If no specific relevant project/specialism is found, write EXACTLY: "work".
4. Do NOT use generic praise like "great building services" or "quality work".

Respond in EXACTLY this JSON format:
{"detail": "5-12 word phrase or work", "fact": "1 short sentence verified fact or No specific details"}`;

    try {
      log(`[Research Helper] Calling DeepSeek/Groq AI...`);
      const aiRes = await fetchAIChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 120
      }, log);

      if (aiRes && aiRes.choices && aiRes.choices[0]) {
        const contentText = aiRes.choices[0].message.content;
        let detail = 'work';
        let fact = 'No specific details found.';

        try {
          const parsed = JSON.parse(contentText);
          if (parsed.detail && parsed.detail.toLowerCase() !== 'work' && parsed.detail.length <= 80) {
            detail = parsed.detail.replace(/^the great\s+/i, '').trim();
          }
          if (parsed.fact) fact = parsed.fact;
        } catch (e) {
          log(`[Research Helper] JSON parse fallback: ${e.message}`);
        }

        const summaryFormatted = `## ⚡ Personalised Detail\n${detail}\n\n## 🔬 Quick Fact\n${fact}`;

        log(`[Research Helper] AI research completed. Detail: "${detail}"`);
        return {
          summary: summaryFormatted,
          status: 'completed'
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
