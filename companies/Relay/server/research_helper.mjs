import { fetchAIChatCompletion } from './ai-client.mjs';
import { performDeepResearch } from './scraper.mjs';

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
export async function researchAndSummarizeLead(lead, log = console.log) {
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

  // Define strict instructions for the AI
  const prompt = `You are an elite business intelligence researcher. Your task is to analyze the scraped website content and search results for the target company and produce a very concise, highly accurate summary.

Target Company: ${companyName}
Website URL: ${rawWebsite || 'N/A'}

Scraped Data:
${scrapedReport}

CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
1. You MUST check the website content (labeled [WEBSITE_HOME], [WEBSITE_ABOUT], [WEBSITE_TEAM]) to find a key fact about the business.
2. The summary MUST be short (maximum 2-3 sentences), easy to refer to during a cold call.
3. The summary MUST include a specific verified key fact about the business (e.g. their specific services, target audience, founding year, client names, or product offerings).
4. If you cannot find verified information from the scraped website content or if the scraped content is empty/errors, do NOT make up any details or niches. Instead, write exactly: "N/A: Website content not available."
5. Never hallucinate niches or details not present in the scraped text. If there is no specific data, write: "N/A: Specific details not available."
6. Ensure you do not get confused between different businesses. Focus only on the target website domain or business name.

Format your response EXACTLY as follows:
## ⚡ Quick Summary
[2-3 concise sentences containing a verified key fact about the business]`;

  try {
    log(`[Research Helper] Calling Groq API...`);
    const aiRes = await fetchAIChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Low temperature to minimize creative hallucination
      model: 'llama-3.3-70b-versatile'
    }, log);

    if (aiRes && aiRes.choices && aiRes.choices[0]) {
      const content = aiRes.choices[0].message.content;
      log(`[Research Helper] AI summary generated successfully.`);
      return {
        summary: content,
        status: content.includes('N/A:') ? 'incomplete' : 'completed'
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
}
