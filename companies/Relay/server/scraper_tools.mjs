import * as cheerio from 'cheerio';
import { detectTechStackFromHtml, formatPhoneNumber, setupBrowser, safeBrowserClose } from './scraper.mjs';

/**
 * Extracts structured data deterministically from raw HTML.
 */
export function extractWebsiteData(html) {
    if (!html) return {};
    
    const $ = cheerio.load(html);
    const data = {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        emails: [],
        phones: [],
        socials: [],
        tech_stack: detectTechStackFromHtml(html),
        services: [],
        pain_points: [],
        growth_signals: []
    };

    // Extract emails
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const bodyText = $('body').text();
    const emails = bodyText.match(emailRegex) || [];
    $('a[href^="mailto:"]').each((i, el) => {
        const href = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
        if (href) emails.push(href);
    });
    data.emails = [...new Set(emails.map(e => e.toLowerCase()))].filter(e => !e.includes('sentry') && !e.includes('wix') && !e.includes('example'));

    // Extract phones
    const phoneRegex = /(?:(?:\+|00)44|0)\s*(?:1\d{2}\s*\d{3}\s*\d{3,4}|1\d{3}\s*\d{5,6}|2\d{2}\s*\d{3}\s*\d{4}|3\d{2}\s*\d{3}\s*\d{4}|7\d{3}\s*\d{6}|8\d{2}\s*\d{3}\s*\d{3,4}|9\d{2}\s*\d{3}\s*\d{3,4})/g;
    const phones = bodyText.match(phoneRegex) || [];
    $('a[href^="tel:"]').each((i, el) => {
        const href = $(el).attr('href').replace('tel:', '').trim();
        if (href) phones.push(href);
    });
    data.phones = [...new Set(phones)].map(formatPhoneNumber);

    // Extract socials
    const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com'];
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
            for (const domain of socialDomains) {
                if (href.includes(domain)) {
                    data.socials.push(href);
                }
            }
        }
    });
    // Extract Growth Signals and Pain Points by analyzing paragraphs
    const painKeywords = ['struggle', 'challenge', 'difficult', 'legacy', 'outdated', 'expensive', 'slow', 'manual process', 'bottleneck', 'complaint', 'frustrating', 'downtime'];
    const growthKeywords = ['hiring', 'expanding', 'launched', 'acquired', 'new office', 'record revenue', 'raised', 'funding', 'partnership', 'growth', 'new location'];
    
    $('p, h1, h2, h3, li').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 30 && text.length < 300) {
            const lowerText = text.toLowerCase();
            
            // Check for pain points
            for (const kw of painKeywords) {
                if (lowerText.includes(kw)) {
                    data.pain_points.push({
                        area: 'Operations & Business',
                        description: text,
                        severity: 'medium'
                    });
                    break;
                }
            }
            
            // Check for growth signals
            for (const kw of growthKeywords) {
                if (lowerText.includes(kw)) {
                    data.growth_signals.push({
                        type: 'expansion',
                        detail: text,
                        date: new Date().getFullYear().toString()
                    });
                    break;
                }
            }
        }
    });

    // Deduplicate
    data.pain_points = data.pain_points.slice(0, 5);
    data.growth_signals = data.growth_signals.slice(0, 5);

    return data;
}

/**
 * Extracts Google Map Ratings from a standard Google Search DOM
 */
export function extractGoogleMapsData(html) {
    if (!html) return { rating: null, reviews: null, address: null };
    
    const $ = cheerio.load(html);
    const bodyText = $('body').text().substring(0, 5000);
    
    const ratingMatch = bodyText.match(/(\d+\.?\d*)\s*(?:out of 5|stars?|★)/i);
    const reviewMatch = bodyText.match(/(\d[\d,]*)\s*(?:reviews?|Google reviews?)/i);
    
    let rating = ratingMatch ? ratingMatch[1] : null;
    let reviews = reviewMatch ? reviewMatch[1] : null;

    // Try to extract Google Maps review snippets from the Knowledge Panel
    const recent_reviews = [];
    $('div[data-md], span[class*="review"], div[class*="review"]').each((i, el) => {
        const text = $(el).text().trim();
        // Look for review-like text: long enough, not just UI text
        if (text.length > 40 && text.length < 500 && !text.includes('Google') && !text.includes('Sort by')) {
            recent_reviews.push(text);
        }
    });

    // Also just look for generic quotes which Google often uses for review snippets
    $('q, blockquote').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) recent_reviews.push(text);
    });

    return { 
        rating, 
        reviews, 
        recent_reviews: [...new Set(recent_reviews)].slice(0, 5) 
    };
}

/**
 * Extracts LinkedIn profiles/pages from Google Search results
 */
export function extractLinkedInData(html) {
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const links = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('linkedin.com/')) {
            const clean = href.split('&')[0].replace('/url?q=', '');
            links.push(clean);
        }
    });
    return [...new Set(links)];
}

/**
 * Extracts complaint snippets from Google Search results (e.g. Trustpilot/Yelp reviews)
 */
export function extractComplaintReviews(html) {
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const complaints = [];
    
    // Look at search result snippets (div.g or .VwiC3b or .aCOpRe)
    $('div.g').each((i, el) => {
        const title = $(el).find('h3').text().trim();
        const snippet = $(el).find('.VwiC3b, .aCOpRe, .lyLwlc, span').text().trim();
        
        // Filter out very short or empty snippets
        if (snippet && snippet.length > 30) {
            // Check if it contains review-like keywords (stars, rating, terrible, avoid, etc.)
            const lower = snippet.toLowerCase();
            if (lower.includes('star') || lower.includes('review') || lower.includes('terrible') || lower.includes('worst') || lower.includes('avoid') || lower.includes('bad')) {
                 complaints.push({
                     source: title || 'Review Site',
                     text: snippet
                 });
            }
        }
    });
    
    // Deduplicate by text
    const unique = [];
    const seen = new Set();
    for (const c of complaints) {
        if (!seen.has(c.text)) {
            seen.add(c.text);
            unique.push(c);
        }
    }
    
    return unique.slice(0, 5); // Return top 5 worst snippets
}

/**
 * The Deterministic Scraper Orchestrator.
 * Replaces performDeepResearch by running explicit scraping tools sequentially.
 */
export async function performDeterministicResearch(company, website, notesContext = '') {
    const log = console.log;
    log(`[Deterministic Scraper] Starting tool-based scrape for ${company} (${website})...`);

    const setup = await setupBrowser(log);
    const browser = setup.browser;
    
    const finalData = {
        company: company,
        website: website,
        website_data: {},
        google_data: {},
        linkedin_links: [],
        news_snippets: [],
        bad_reviews: []
    };

    try {
        // 1. Scrape Website
        if (website && website.startsWith('http')) {
            log(`[Deterministic Scraper] Calling tool: scrapeWebsiteData`);
            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 20000 });
                const html = await page.content();
                finalData.website_data = extractWebsiteData(html);
                await page.close();
            } catch (e) {
                log(`[Deterministic Scraper] Website tool error: ${e.message}`);
            }
        }

        // 2. Google Maps / Reviews Tool
        log(`[Deterministic Scraper] Calling tool: scrapeGoogleMapsData`);
        try {
            const page = await browser.newPage();
            const mapsQuery = `${company} google reviews rating`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(mapsQuery)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const html = await page.content();
            finalData.google_data = extractGoogleMapsData(html);
            await page.close();
        } catch (e) {
            log(`[Deterministic Scraper] Google tool error: ${e.message}`);
        }

        // 3. LinkedIn Profiles Tool
        log(`[Deterministic Scraper] Calling tool: scrapeLinkedInData`);
        try {
            const page = await browser.newPage();
            const liQuery = `${company} CEO founder owner director team linkedin`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(liQuery)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const html = await page.content();
            finalData.linkedin_links = extractLinkedInData(html).slice(0, 5);
            await page.close();
        } catch (e) {
            log(`[Deterministic Scraper] LinkedIn tool error: ${e.message}`);
        }

        // 4. News Tool
        try {
            const page = await browser.newPage();
            const newsQuery = `"${company}" news recent`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(newsQuery)}&tbm=nws`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const snippets = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('div.SoaBEf, div.WlydOe, article')).map(el => el.innerText).slice(0, 3);
            });
            finalData.news_snippets = snippets;
            await page.close();
        } catch (e) {
            log(`[Deterministic Scraper] News tool error: ${e.message}`);
        }

        // 5. Complaint/Bad Reviews Tool
        log(`[Deterministic Scraper] Calling tool: extractComplaintReviews`);
        try {
            const page = await browser.newPage();
            // We search for the company name plus words that trigger review snippets
            const complaintQuery = `"${company}" (reviews OR complaints OR "1 star" OR terrible OR avoid)`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(complaintQuery)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const html = await page.content();
            finalData.bad_reviews = extractComplaintReviews(html);
            await page.close();
        } catch (e) {
            log(`[Deterministic Scraper] Complaint tool error: ${e.message}`);
        }

        return JSON.stringify(finalData, null, 2);
    } catch (e) {
        log(`[Deterministic Scraper] Fatal Error: ${e.message}`);
        return `{"error": "Failed to perform deterministic research: ${e.message}"}`;
    } finally {
        await safeBrowserClose(browser);
    }
}
