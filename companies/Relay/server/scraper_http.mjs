import axios from 'axios';

// Helper: Extract emails from text
function extractEmails(text) {
    const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(regex) || [];
}

// Helper: Extract phones from text
function extractPhones(text) {
    const usRegex = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const intlRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    
    const usMatches = text.match(usRegex) || [];
    if (usMatches.length > 0) return usMatches;
    
    return text.match(intlRegex) || [];
}

// Scrape website via HTTP
export async function scrapeWebsiteHttp(url, log = console.log) {
    log(`[HTTP Scraper] Visiting website: ${url}`);
    const data = { email: '', phone: '', website: url, company: '', pain_points: [] };
    
    try {
        const response = await axios.get(url, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        const html = response.data;
        
        // Extract emails
        const emails = extractEmails(html);
        if (emails.length > 0) {
            data.email = emails[0]; // Take first email
            log(`[HTTP Scraper] Found email: ${data.email}`);
        }
        
        // Extract phones
        const phones = extractPhones(html);
        if (phones.length > 0) {
            data.phone = phones[0]; // Take first phone
            log(`[HTTP Scraper] Found phone: ${data.phone}`);
        }
        
        // Try to extract title as company name
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
            data.company = titleMatch[1].trim();
        }

        // --- SMART AUDIT FOR LEAD PAIN POINTS ---
        const painPoints = [];
        if (!url.startsWith('https://')) {
            painPoints.push('No SSL Security (HTTP)');
        }
        
        const currentYear = new Date().getFullYear();
        const copyrightMatch = html.match(/(?:©|copyright)\s*(20\d{2})/i);
        if (copyrightMatch) {
            const year = parseInt(copyrightMatch[1]);
            if (year < currentYear - 1) {
                painPoints.push(`Outdated Website (Copyright ${year})`);
            }
        }
        
        const socialPatterns = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com'];
        const missingSocials = socialPatterns.filter(pattern => !html.includes(pattern));
        if (missingSocials.length === socialPatterns.length) {
            painPoints.push('No Social Media Footprint');
        }

        data.pain_points = painPoints;
        
    } catch (error) {
        log(`[HTTP Scraper] Failed to visit ${url}: ${error.message}`);
    }
    
    return data;
}

// Scrape DuckDuckGo via HTTP (Non-JS version)
export async function scrapeDuckDuckGo(query, limit = 20, log = console.log, onResult = null) {
    log(`[HTTP Scraper] Searching DuckDuckGo for: ${query}`);
    const leads = [];
    
    try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en&k1=-1`;
        
        const response = await axios.get(ddgUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Cookie': 'kl=us-en; k1=-1;' 
            },
            timeout: 10000
        });
        
        const html = response.data;
        log(`[HTTP Scraper] DuckDuckGo response length: ${html.length}`);
        
        if (html.includes('anomaly-modal') || html.includes('bots use DuckDuckGo too') || html.includes('Checking your browser')) {
            log(`[HTTP Scraper] WARNING: DuckDuckGo CAPTCHA or Bot Detection. Trying Lite version...`);
            const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
            const liteResponse = await axios.get(liteUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
            }).catch(() => null);
            
            if (!liteResponse || liteResponse.data.includes('Checking your browser')) {
                 log(`[HTTP Scraper] CRITICAL: Both DDG versions blocked.`);
                 return [];
            }
            return parseDuckDuckGoLite(liteResponse.data, limit, log, onResult);
        }

        // Standard HTML version parsing
        const matches = html.matchAll(/<a[^>]+class="result__url"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
        let count = 0;
        
        for (const match of matches) {
            if (count >= limit) break;
            
            let url = match[1];
            // Decode DDG proxy links
            if (url.includes('duckduckgo.com/l/?')) {
                const urlObj = new URL(url, 'https://duckduckgo.com');
                url = urlObj.searchParams.get('uddg') || url;
            }
            
            const title = match[2].replace(/<[^>]+>/g, '').trim();
            if (!title || title.includes('duckduckgo.com')) continue;

            log(`[HTTP Scraper] Found search result: ${title} (${url})`);
            
            const lead = {
                id: `scraped-${Math.random().toString(36).substr(2, 9)}`,
                company: title,
                website: url,
                status: 'New',
                source: 'DuckDuckGo'
            };
            
            leads.push(lead);
            count++;
            if (onResult) onResult(lead).catch(() => {});
        }
        
    } catch (error) {
        log(`[HTTP Scraper] DuckDuckGo search failed: ${error.message}`);
    }
    
    // Fallback for empty results
    if (leads.length === 0) {
        const words = query.trim().split(/\s+/);
        if (words.length > 2) {
            const fallbackQuery = words.slice(0, 2).join(' ');
            log(`[HTTP Scraper] Retrying with broader query: "${fallbackQuery}"`);
            return scrapeDuckDuckGo(fallbackQuery, limit, log, onResult);
        }
    }
    
    return leads;
}

// Helper: Parse DDG Lite HTML
function parseDuckDuckGoLite(html, limit, log, onResult) {
    const leads = [];
    const matches = html.matchAll(/<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
    let count = 0;
    for (const match of matches) {
        if (count >= limit) break;
        let url = match[1];
        if (url.includes('duckduckgo.com/l/?')) {
            const urlObj = new URL(url, 'https://duckduckgo.com');
            url = urlObj.searchParams.get('uddg') || url;
        }
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        if (!title || title.includes('duckduckgo.com')) continue;

        const lead = {
            id: `lite-${Math.random().toString(36).substr(2, 9)}`,
            company: title,
            website: url,
            status: 'New',
            source: 'DuckDuckGo Lite'
        };
        leads.push(lead);
        count++;
        if (onResult) onResult(lead).catch(() => {});
    }
    return leads;
}

// Main Scrape Function that mimics the one in index.mjs
export async function scrapeLeadsNoPuppeteer(query, limit = 20, log = console.log, onResult = null) {
    log(`[HTTP Scraper] Starting scrape for "${query}" without Puppeteer`);
    
    // Step 1: Search DuckDuckGo
    const results = await scrapeDuckDuckGo(query, limit, log);
    
    // Step 2: For each result, try to find contact info by visiting the website
    const leads = [];
    for (const result of results) {
        if (result.website) {
            const webData = await scrapeWebsiteHttp(result.website, log);
            
            // Keep all leads if they have a website (Graceful Degradation / Fallback)
            if (webData.email || result.website) {
                const finalLead = {
                    ...result,
                    email: webData.email || '',
                    phone: webData.phone || '',
                    company: webData.company || result.company || result.title,
                    pain_points: webData.pain_points || [],
                    summary: webData.pain_points && webData.pain_points.length > 0
                        ? `## ⚡ Quick Summary\nThis business was identified as having potential digital improvements: ${webData.pain_points.join(', ')}.\n\n## 🔬 Deep Research\n- Website: ${result.website}\n- Identified Pain Points: ${webData.pain_points.join(', ')}`
                        : `## ⚡ Quick Summary\nScraped business website (fallback lead without direct contact email).\n\n## 🔬 Deep Research\n- Website: ${result.website}`
                };
                
                leads.push(finalLead);
                
                if (onResult) {
                    onResult(finalLead).catch(err => log(`Error in onResult callback: ${err.message}`));
                }
            }
        }
    }
    
    return leads;
}

