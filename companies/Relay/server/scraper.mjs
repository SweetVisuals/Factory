import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { validateEmail } from './email-validation.mjs';
import { fetchAIChatCompletion } from './ai-client.mjs';
import { generateStructuredResearchFromText } from './research_helper.mjs';

import axios from 'axios';
import * as cheerio from 'cheerio';
const execPromise = util.promisify(exec);

/**
 * Safely close a Playwright/Camoufox browser with a timeout.
 * If browser.close() hangs (e.g. zombie process), forcefully kill the browser process.
 * This prevents the recurring issue where zombie camoufox processes permanently block
 * the activeScrapes concurrency counter.
 */
export async function safeBrowserClose(browser, timeoutMs = 10000) {
  cleanupTmpProfiles();
  if (!browser) return;
  let browserPid;
  try {
    // Playwright/Camoufox exposes the browser process
    browserPid = browser.process?.()?.pid;
  } catch (e) { /* ignore */ }

  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('browser.close() timed out')), timeoutMs)
      )
    ]);
  } catch (err) {
    console.error(`[Scraper] browser.close() failed or timed out: ${err.message}. Force-killing process...`);
    try {
      // Find all camoufox-bin processes that are children of the current Node process and kill them
      const { execSync } = await import('child_process');
      const pid = process.pid;
      // Get all processes where PPID is our PID
      const output = execSync(`ps -o pid= -o ppid= -o comm= | awk '$2 == ${pid} && /camoufox/ {print $1}'`).toString().trim();
      if (output) {
        const pidsToKill = output.split('\n').map(p => p.trim()).filter(Boolean);
        for (const p of pidsToKill) {
          try {
            process.kill(parseInt(p, 10), 'SIGKILL');
            console.log(`[Scraper] Force-killed zombie child Camoufox PID ${p}`);
          } catch(e) { }
        }
      } else {
        console.error(`[Scraper] Could not find child Camoufox processes to force-kill.`);
      }
    } catch (killErr) {
      console.error(`[Scraper] Error while trying to force-kill child Camoufox processes: ${killErr.message}`);
    }
  }
}

export function formatLocation(loc, fallback = '') {
    let cleaned = (loc || fallback || '').trim();
    if (!cleaned) return '';
    cleaned = cleaned.replace(/^[\s📍]+/, '').trim();
    return cleaned ? ` ${cleaned}` : '';
}

export function formatPhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    else if (cleaned.startsWith('0')) cleaned = '+44' + cleaned.slice(1);
    else if (cleaned.startsWith('44')) cleaned = '+' + cleaned;
    else if (!cleaned.startsWith('+') && cleaned.length >= 9) cleaned = '+44' + cleaned;

    if (cleaned.startsWith('+44')) {
        let core = cleaned.slice(3);
        if (core.length === 10) {
            if (core.startsWith('2')) {
                return `+44 ${core.slice(0, 2)} ${core.slice(2, 6)} ${core.slice(6)}`;
            } else if (core.startsWith('3') || core.startsWith('8') || core.startsWith('11') || /^1[2-9]1/.test(core)) {
                return `+44 ${core.slice(0, 3)} ${core.slice(3, 6)} ${core.slice(6)}`;
            } else {
                return `+44 ${core.slice(0, 4)} ${core.slice(4)}`;
            }
        }
        return `+44 ${core}`;
    }

    return cleaned;
}

export function detectTechStackFromHtml(html) {
    if (!html) return [];
    const tech = [];
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes')) tech.push('WordPress');
    if (lowerHtml.includes('shopify.theme') || lowerHtml.includes('cdn.shopify.com') || lowerHtml.includes('shopify')) tech.push('Shopify');
    if (lowerHtml.includes('data-wf-page') || lowerHtml.includes('webflow')) tech.push('Webflow');
    if (lowerHtml.includes('gtag') || lowerHtml.includes('google-analytics') || lowerHtml.includes('googleanalytics') || lowerHtml.includes('ua-')) tech.push('Google Analytics');
    if (lowerHtml.includes('fbpixel') || lowerHtml.includes('connect.facebook.net') || lowerHtml.includes('fbq(')) tech.push('Facebook Pixel');
    if (lowerHtml.includes('js.hs-scripts.com') || lowerHtml.includes('hubspot')) tech.push('HubSpot');
    if (lowerHtml.includes('wix-first-paint') || lowerHtml.includes('wix.com')) tech.push('Wix');
    if (lowerHtml.includes('squarespace.com') || lowerHtml.includes('static1.squarespace.com')) tech.push('Squarespace');
    if (lowerHtml.includes('sentry.io')) tech.push('Sentry');
    if (lowerHtml.includes('cloudflare.com')) tech.push('Cloudflare');
    if (lowerHtml.includes('stripe.com') || lowerHtml.includes('stripe.js')) tech.push('Stripe');
    if (lowerHtml.includes('bootstrap.min.css') || lowerHtml.includes('bootstrap.min.js')) tech.push('Bootstrap');
    if (lowerHtml.includes('jquery.min.js') || lowerHtml.includes('jquery-')) tech.push('jQuery');
    if (lowerHtml.includes('/_next/') || lowerHtml.includes('next.js')) tech.push('Next.js');
    if (lowerHtml.includes('react')) tech.push('React');
    if (lowerHtml.includes('tailwind')) tech.push('TailwindCSS');
    if (lowerHtml.includes('elementor')) tech.push('Elementor (WordPress)');
    if (lowerHtml.includes('yoast')) tech.push('Yoast SEO');
    if (lowerHtml.includes('recaptcha')) tech.push('Google reCAPTCHA');
    return [...new Set(tech)];
}

export function extractServicesFromHtml($, html) {
    const services = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const hrefLower = href.toLowerCase();
        if (text && text.length > 3 && text.length < 35) {
            if (hrefLower.includes('/services') || hrefLower.includes('/what-we-do') || hrefLower.includes('/solutions') || hrefLower.includes('/products/') || hrefLower.includes('/capabilities')) {
                if (!services.includes(text) && !/contact|about|home|blog|news|careers/i.test(text)) {
                    services.push(text);
                }
            }
        }
    });
    if (services.length < 3) {
        $('h2, h3').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 3 && text.length < 35) {
                if (!/contact|about|subscribe|follow|copyright|latest|news|blog|testimonials/i.test(text)) {
                    services.push(text);
                }
            }
        });
    }
    return [...new Set(services)].slice(0, 10);
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const createLogger = (onLog) => (message) => {
    try {
        const logPath = 'scraper_debug.log';
        if (fs.existsSync(logPath) && fs.statSync(logPath).size > 5 * 1024 * 1024) {
            fs.writeFileSync(logPath, `[${new Date().toISOString()}] [Log Rotated - 5MB Limit Reached]\n`);
        }
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
    } catch (e) {
        console.error('Error writing to scraper_debug.log:', e);
    }
    console.log(message);
    // Supabase debug log insert removed to prevent database storage bloat
    if (onLog && typeof onLog === 'function') {
        try {
            onLog(message);
        } catch (e) {
            console.error('Error in onLog callback:', e);
        }
    }
};


// Helper: Clean text
const cleanText = (text) => {
    return text
        .replace(/\s+/g, ' ')
        .trim();
};

// Helper to auto-scroll a page (for websites) to trigger lazy loads
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 15000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 50); // Fast scroll
        });
    });
}

// Helper to block unnecessary resources and save memory/bandwidth
async function applyResourceBlocker(page) {
    try {
        const shouldBlock = (url, resourceType) => {
            url = url.toLowerCase();
            return ['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'].includes(resourceType) ||
                url.includes('google-analytics') || url.includes('analytics') || 
                url.includes('facebook.com') || url.includes('doubleclick') || 
                url.includes('pixel') || url.includes('hotjar') || url.includes('adsystem');
        };

        if (page.setRequestInterception) {
            // Puppeteer
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (shouldBlock(request.url(), request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
        } else if (page.route) {
            // Playwright / Camoufox
            await page.route('**/*', (route) => {
                const request = route.request();
                if (shouldBlock(request.url(), request.resourceType())) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
        }
    } catch (e) {
        console.error('Resource blocker setup failed:', e.message);
    }
}

// Lightweight Chrome launch args — minimal resource usage
const LIGHTWEIGHT_CHROME_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-features=IsolateOrigins,site-per-process',
    '--blink-settings=imagesEnabled=false',
    '--disable-extensions',
    '--disable-component-update',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
    '--password-store=basic',
    '--use-mock-keychain'
];

// Helper to truncate logs if they exceed 5MB
function truncateLogs(filePath, maxSizeMB = 5) {
    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            if (fileSizeMB > maxSizeMB) {
                const content = fs.readFileSync(filePath, 'utf8');
                const truncated = content.substring(content.length / 2); // Keep last half
                fs.writeFileSync(filePath, truncated);
                console.log(`[SYSTEM] Truncated log file ${filePath} (Size: ${fileSizeMB.toFixed(2)}MB)`);
            }
        }
    } catch (e) {
        console.error(`Error truncating logs: ${e.message}`);
    }
}

// Clean up temporary Chrome profile directories
function cleanupTmpProfiles() {
    try {
        const tmpDir = './tmp';
        if (!fs.existsSync(tmpDir)) return;
        const entries = fs.readdirSync(tmpDir);
        for (const entry of entries) {
            if (entry.startsWith('profile_')) {
                const fullPath = `${tmpDir}/${entry}`;
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } catch (e) {
                    // EBUSY is expected if a browser is still using it
                }
            }
        }
    } catch (e) { /* ignore */ }
}

// Helper to setup browser consistently — lightweight mode
export async function setupBrowser(log, options = {}) {
    if (log) log('[Camoufox Engine] Initializing stealth anti-detection browser...');
    try {
        const { Camoufox } = await import('camoufox-js');
        const browser = await Camoufox({ headless: true });
        
        // Add Puppeteer backward-compatibility shims to prevent legacy scraper crashes
        const origNewPage = browser.newPage.bind(browser);
        browser.newPage = async (...args) => {
            const page = await origNewPage(...args);
            if (!page.setUserAgent) {
                page.setUserAgent = async () => {}; // No-op: Camoufox auto-spoofs fingerprint at C++ level
            }
            if (!page.setViewport && page.setViewportSize) {
                page.setViewport = async (opts) => page.setViewportSize(opts);
            }
            try {
                await applyResourceBlocker(page);
            } catch (e) { /* ignore */ }
            return page;
        };

        return { browser, profileDir: null };
    } catch (err) {
        if (log) log(`[Camoufox Error] Failed to start Camoufox: ${err.message}`);
        throw err;
    }
}


export async function scrapeGoogleMaps(query, limit = 50, onLog = null, onResult = null, notesContext = '', deepResearch = false, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting Native Google Maps Scraper for: ${query} (Target: ${limit})`);
    
    let leads = [];
    let browser;
    try {
        const { Camoufox } = await import('camoufox-js');
        browser = await Camoufox({ headless: true });
        const page = await browser.newPage();
        await applyResourceBlocker(page);
        try {
            if (page.setViewportSize) {
                await page.setViewportSize({ width: 1280, height: 800 });
            } else if (page.setViewport) {
                await page.setViewport({ width: 1280, height: 800 });
            }
        } catch (e) {
            log(`[Scraper] Warning: Could not set viewport size: ${e.message}`);
        }

        const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
        log(`Navigating to Google Maps: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        try {
            const consentBtn = await page.$('form[action*="consent"] button, button[aria-label*="Alle akzeptieren" i], button[aria-label*="Accept all" i]');
            if (consentBtn) {
                await consentBtn.click();
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch(e) {}

        log("Waiting for results pane...");
        try {
            await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
        } catch(e) {
            log("Feed not found, possibly no results or blocked.");
            return leads;
        }
        
        log("Scrolling feed...");
        let previousHeight = 0;
        let sameHeightCount = 0;
        
        while (true) {
            if (checkState) await checkState();
            const feedHandle = await page.$('div[role="feed"]');
            if (!feedHandle) break;
            
            const currentCount = await page.evaluate((feed) => {
                return document.querySelectorAll('a.hfpxzc').length;
            }, feedHandle);
            
            if (currentCount >= limit) break;
            
            const newHeight = await page.evaluate((feed) => {
                feed.scrollTop = feed.scrollHeight;
                return feed.scrollHeight;
            }, feedHandle);
            
            if (newHeight === previousHeight) {
                sameHeightCount++;
                if (sameHeightCount >= 5) break;
            } else {
                sameHeightCount = 0;
            }
            previousHeight = newHeight;
            await new Promise(r => setTimeout(r, 4000));
        }

        const places = await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('div[role="feed"] > div > div');
            items.forEach((item) => {
                const titleEl = item.querySelector('div.fontHeadlineSmall');
                if (!titleEl) return;
                const title = titleEl.innerText;
                
                let url = '';
                const link = item.querySelector('a');
                if (link) url = link.href;

                if (title) {
                    let feedRating = null;
                    let feedReviews = 0;
                    
                    const ratingSpan = item.querySelector('span[role="img"][aria-label]');
                    if (ratingSpan) {
                        const ariaLabel = ratingSpan.getAttribute('aria-label');
                        const match = ariaLabel.match(/([0-9.,]+)\s*(?:stars?|Sterne?)/i);
                        if (match) feedRating = parseFloat(match[1].replace(',', '.'));
                        
                        const rMatch = ariaLabel.match(/([0-9,.]+)\s*(?:reviews?|Rezensionen?)/i);
                        if (rMatch) feedReviews = parseInt(rMatch[1].replace(/[,.]/g, ''), 10);
                    }
                    
                    results.push({ title, url, feedRating, feedReviews });
                }
            });
            return results;
        });

        log(`Extracted ${places.length} places from feed. Fetching details...`);

        for (const place of places) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            const name = place.title || '';
            if (!name) continue;

            log(`Clicking ${name} to get details...`);
            try {
                await page.goto(place.url, { waitUntil: 'networkidle', timeout: 15000 });
                await new Promise(r => setTimeout(r, 4000));
            } catch (navErr) {
                log(`Navigation timeout for ${name}, trying to extract anyway...`);
            }

            const details = await page.evaluate(async () => {
                // 1. EXTRACT OVERVIEW & STATIC DATA FIRST BEFORE CLICKING OTHER TABS
                const addressBtn = document.querySelector('button[data-item-id="address"]') || document.querySelector('button[aria-label*="Address"]');
                let address = '';
                if (addressBtn) {
                    const aria = addressBtn.getAttribute('aria-label') || '';
                    if (aria && aria.toLowerCase().includes('address:')) {
                        address = aria.replace(/^[^:]*Address:\s*/i, '').trim();
                    } else {
                        address = addressBtn.innerText.replace(/^.*\n/, '').trim();
                    }
                }
                if (!address) {
                    const textElements = Array.from(document.querySelectorAll('div, span, button')).filter(el => el.getAttribute('aria-label') && el.getAttribute('aria-label').includes('Address:'));
                    if (textElements.length > 0) {
                        address = textElements[0].getAttribute('aria-label').replace(/^[^:]*Address:\s*/i, '').trim();
                    }
                }

                const websiteBtn = document.querySelector('a[data-item-id="authority"]') || document.querySelector('a[data-tooltip="Open website"]');
                const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]') || document.querySelector('button[aria-label*="Phone"]');
                let phone = '';
                if (phoneBtn) {
                    const ariaPhone = phoneBtn.getAttribute('aria-label') || '';
                    if (ariaPhone.toLowerCase().includes('phone:')) {
                        phone = ariaPhone.replace(/^[^:]*Phone:\s*/i, '').trim();
                    } else {
                        phone = phoneBtn.innerText.replace(/^.*\n/, '').trim();
                    }
                }

                const categoryBtn = document.querySelector('button[jsaction*="pane.rating.category"]') || document.querySelector('span[class*="fontBodyMedium"] button') || document.querySelector('button[data-item-id="category"]');
                const category = categoryBtn ? categoryBtn.innerText.trim() : '';

                // 2. NOW SWITCH TO REVIEWS TAB & EXTRACT REVIEWS
                let review_count = 0;
                let rating = null;
                let bad_reviews = [];
                try {
                    const reviewEls = Array.from(document.querySelectorAll('[aria-label*="reviews" i], [aria-label*="Rezensionen" i], button[jsaction*="pane.rating.moreReviews"]'));
                    for (const el of reviewEls) {
                        const text = el.innerText || el.getAttribute('aria-label') || '';
                        const match = text.match(/([\d,.]+)\s*(?:reviews?|Rezensionen?)/i);
                        if (match) {
                            review_count = parseInt(match[1].replace(/,/g, ''), 10);
                            break;
                        }
                    }
                    
                    const ratingEls = Array.from(document.querySelectorAll('[aria-label*="stars" i], [aria-label*="star" i], [aria-label*="Sterne" i], span.ceNzKf, div.F7nice span'));
                    for (const el of ratingEls) {
                        const text = el.getAttribute('aria-label') || el.innerText || '';
                        const match = text.match(/([\d\.,]+)\s*(?:stars?|Sterne?)/i) || text.match(/^([\d\.,]+)/);
                        if (match) {
                            const parsed = parseFloat(match[1]);
                            if (parsed > 0 && parsed <= 5) {
                                rating = parsed;
                                break;
                            }
                        }
                    }
                    
                    const reviewsTab = Array.from(document.querySelectorAll('button')).find(el => el.innerText.includes('Reviews') && el.getAttribute('data-item-id') === 'review') || document.querySelector('button[data-item-id="review"]');
                    if (reviewsTab) {
                        reviewsTab.click();
                        await new Promise(r => setTimeout(r, 2000));
                        
                        const sortBtn = document.querySelector('button[data-value="Sort"]') || document.querySelector('button[aria-label*="Sort"]');
                        if (sortBtn) {
                            sortBtn.click();
                            await new Promise(r => setTimeout(r, 1000));
                            const newest = Array.from(document.querySelectorAll('div[role="menuitemradio"]')).find(el => el.innerText.includes('Newest') || el.innerText.includes('Neueste') || el.innerText.includes('Most relevant') || el.innerText.includes('Relevanteste'));
                            if (newest) {
                                newest.click();
                                await new Promise(r => setTimeout(r, 3000));
                            }
                        }

                        const reviewBlocks = document.querySelectorAll('div.jftiEf');
                        for (const block of reviewBlocks) {
                            if (bad_reviews.length >= 5) break;
                            const textEl = block.querySelector('span.wiI7pd');
                            const text = textEl ? textEl.innerText.trim() : '';
                            if (text && text.length > 20) {
                                bad_reviews.push({ text: text.substring(0, 500), source: "Google Maps" });
                            }
                        }
                    }
                } catch(e) {}
                
                return {
                    address,
                    website: websiteBtn ? websiteBtn.href : '',
                    phone,
                    category,
                    rating,
                    review_count,
                    bad_reviews
                };
            });

            let website = details.website || '';
            const phone = formatPhoneNumber(details.phone);
            const address = details.address || '';
            const category = details.category || '';
            const rating = details.rating || place.feedRating;
            const review_count = details.review_count || place.feedReviews || 0;
            
            if (!name) continue;

            // Removed strict rating/review count filtering to capture all leads

            let email = '';
            let social = { linkedin: '', facebook: '', twitter: '', instagram: '' };
            let tech_stack = [];
            let services_offered = [];
            let company_description = '';

            // Fast deep scrape if website exists
            if (website && !website.includes('google.com')) {
                if (!website.startsWith('http')) website = 'http://' + website;
                
                const extractFromHtml = (html) => {
                    const $ = cheerio.load(html);
                    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
                    const textContent = $('body').text();
                    const hrefEmails = [];
                    $('a[href^="mailto:"]').each((i, el) => {
                        const mailto = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
                        if (mailto) hrefEmails.push(mailto);
                    });
                    const bodyEmails = textContent.match(emailRegex) || [];
                    const allEmails = [...hrefEmails, ...bodyEmails];
                    const validEmails = allEmails.filter(e => {
                        const low = e.toLowerCase();
                        return !low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.svg') && !low.includes('sentry') && !low.includes('example') && !low.includes('wixpress') && !low.includes('@2x');
                    });
                    
                    $('a').each((i, el) => {
                        const href = $(el).attr('href');
                        if (href) {
                            if (href.includes('linkedin.com/company') || href.includes('linkedin.com/in')) social.linkedin = href;
                            if (href.includes('facebook.com') && !href.includes('sharer')) social.facebook = href;
                            if (href.includes('instagram.com')) social.instagram = href;
                            if (href.includes('twitter.com') || href.includes('x.com')) social.twitter = href;
                        }
                    });

                    // NATIVE EXTRACTION WITHOUT AI:
                    try {
                        tech_stack = detectTechStackFromHtml(html);
                        services_offered = extractServicesFromHtml($, html);
                        const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
                        if (metaDesc) company_description = metaDesc.trim();
                    } catch (e) {
                        log(`Error during native extraction: ${e.message}`);
                    }

                    return validEmails;
                };
                
                try {
                    const webRes = await axios.get(website, { 
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                    const validEmails = extractFromHtml(webRes.data);
                    if (validEmails.length > 0) email = validEmails[0];
                    
                    // If no email on homepage, try /contact and /about pages
                    if (!email) {
                        const baseUrl = new URL(website).origin;
                        const contactPages = ['/contact', '/contact-us', '/about', '/about-us', '/get-in-touch'];
                        for (const page of contactPages) {
                            try {
                                const pageRes = await axios.get(`${baseUrl}${page}`, { 
                                    timeout: 3000, 
                                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                                });
                                const pageEmails = extractFromHtml(pageRes.data);
                                if (pageEmails.length > 0) {
                                    email = pageEmails[0];
                                    break;
                                }
                            } catch (e) { /* page doesn't exist, skip */ }
                        }
                    }

                } catch (e) {
                    log(`Failed to fast-scan ${website}: ${e.message}`);
                }
            }

            const lead = {
                id: `scraped-${Math.random().toString(36).substr(2, 9)}`,
                name: '',
                title: '',
                status: 'New',
                company: name,
                email, 
                phone, 
                website, 
                summary: company_description || '',
                company_description: company_description || '',
                role: '',
                twitter: social.twitter, 
                facebook: social.facebook, 
                instagram: social.instagram, 
                linkedin: social.linkedin, 
                tiktok: '',
                location: formatLocation(address, query),
                industry: category,
                tech_stack: tech_stack,
                services_offered: services_offered,
                review_count: details.review_count !== undefined ? details.review_count : 0,
                bad_reviews: details.bad_reviews || [],
                source: 'Native Maps'
            };

            log(`Found: ${name} (Email: ${email || 'No'} | Phone: ${phone || 'No'} | Website: ${website || 'No'})`);
            
            leads.push(lead);
            if (onResult && typeof onResult === 'function') {
                onResult(lead).catch(err => log(`Error in onResult callback: ${err.message}`));
            }
        }
        
        log(`Scraping Complete. Successfully extracted ${leads.length} leads.`);
        return leads;
    } catch (e) {
        log(`Error in Native Maps Scraper: ${e.message}`);
        return leads;
    } finally {
        await safeBrowserClose(browser);
    }
}

export async function scrapeLinkedIn(query, limit = 20, onLog = null, onResult = null, notesContext = '', deepResearch = false, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting LinkedIn scraper for: ${query}`);

    let setup;
    let browser;
    try {
        setup = await setupBrowser(log);
        browser = setup.browser;
        return await scrapeGoogleSearch(browser, query, limit, log, 'linkedin', onResult, notesContext, deepResearch, checkState);
    } catch (error) {
        log(`LinkedIn Scraping Error: ${error.message}`);
        throw error;
    } finally {
        await safeBrowserClose(browser);
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

// General Business Search (Apollo replacement)
export async function scrapeGeneralSearch(query, limit = 20, onLog = null, onResult = null, notesContext = '', deepResearch = false, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting General Search for: ${query}`);

    let setup;
    let browser;
    try {
        setup = await setupBrowser(log);
        browser = setup.browser;
        return await scrapeGoogleSearch(browser, query, limit, log, 'general', onResult, notesContext, deepResearch, checkState);
    } catch (error) {
        log(`General Scraping Error: ${error.message}`);
        throw error;
    } finally {
        await safeBrowserClose(browser);
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

// Shared Google SERP Scraper
async function scrapeGoogleSearch(browser, query, limit, log, type, onResult = null, notesContext = '', deepResearch = false, checkState = null) {
    const page = await browser.newPage();
    await applyResourceBlocker(page);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Go to Google (US Region Enforced)
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`, { waitUntil: 'networkidle2', timeout: 60000 });

    const leads = [];
    let pageNum = 1;

    while (leads.length < limit && pageNum <= 5) { // Limit to 5 pages
        if (checkState) await checkState();
        log(`Processing page ${pageNum}...`);

        // Extract results
        const results = await page.$$eval('div.g', (elements, type) => {
            return elements.map(el => {
                const titleEl = el.querySelector('h3');
                const linkEl = el.querySelector('a');
                const snippetEl = el.querySelector('div[style*="-webkit-line-clamp"]') || el.querySelector('span');

                if (!titleEl || !linkEl) return null;

                return {
                    title: titleEl.innerText,
                    url: linkEl.href,
                    snippet: snippetEl ? snippetEl.innerText : ''
                };
            }).filter(r => r !== null);
        }, type);

        log(`Found ${results.length} results on page ${pageNum}`);

        for (const result of results) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            // processing
            let lead = {
                id: `scraped-${Math.random().toString(36).substr(2, 9)}`,
                status: 'New',
                source: type === 'linkedin' ? 'LinkedIn' : 'General Search',
                name: '',
                company: '',
                role: '',
                email: '',
                phone: '',
                website: '',
                linkedin: '',
                location: ''
            };

            if (type === 'linkedin') {
                // Parse LinkedIn Title: "Name - Role - Company | LinkedIn" or similar
                // Example: "John Doe - CEO - Apple | LinkedIn"
                // Example: "Jane Smith | LinkedIn"
                const cleanTitle = result.title.replace(' | LinkedIn', '').replace(' - LinkedIn', '');
                const parts = cleanTitle.split(' - ');

                if (parts.length >= 1) lead.name = parts[0];
                if (parts.length >= 2) lead.role = parts[1];
                if (parts.length >= 3) lead.company = parts[2];

                lead.linkedin = result.url;
                lead.snippet = result.snippet; // Might contain location

                log(`LinkedIn Lead: ${lead.name} (${lead.role} at ${lead.company})`);
                leads.push(lead);
                if (onResult && typeof onResult === 'function') {
                    onResult(lead).catch(err => log(`Error in onResult callback (LinkedIn): ${err.message}`));
                }
            } else {
                // General Search
                lead.company = result.title;
                lead.website = result.url;

                if (lead.website && !lead.website.includes('google') && !lead.website.includes('linkedin')) {
                    // Try to scrape the website for email details
                    log(`Visiting ${lead.website} for details...`);
                    try {
                        const webData = await scrapeWebsite(browser, lead.website, log, notesContext, deepResearch, lead.company);
                        if (webData.email) lead.email = webData.email;
                        if (webData.phone) lead.phone = webData.phone;
                        if (webData.summary) lead.summary = webData.summary;
                        if (webData.linkedin) lead.linkedin = webData.linkedin;
                        // Only add if we found something useful or if loose mode
                        if (lead.email || lead.phone) {
                            log(`Found: ${lead.company} (Email: ${lead.email || 'No'} | Phone: ${lead.phone || 'No'})`);
                            leads.push(lead);
                            if (onResult && typeof onResult === 'function') {
                                onResult(lead).catch(err => log(`Error in onResult callback (General): ${err.message}`));
                            }
                        } else {
                            log(`Dropped ${lead.company}: No info found.`);
                        }
                    } catch (e) {
                        log(`Failed to visit ${lead.website}: ${e.message}`);
                    }
                }
            }
        }

        if (leads.length >= limit) break;

        // Next page
        try {
            const nextButton = await page.$('a#pnnext');
            if (nextButton) {
                log('Navigating to next page...');
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    nextButton.click()
                ]);
                pageNum++;
            } else {
                log('No next page found.');
                break;
            }
        } catch (e) {
            log('Error navigating to next page.');
            break;
        }
    }

    return leads;
}


// Retaining Helper Functions
async function googleSearchEmail(browser, companyName, website) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Strategy: Search for "Company Name email contact"
        const query = `${companyName} email address contact`;
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`, { waitUntil: 'domcontentloaded', timeout: 5000 });

        const content = await page.content();
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        const emails = content.match(emailRegex) || [];

        const validEmails = emails.filter(e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('example') && !e.includes('google'));

        // Validate found emails
        for (const email of validEmails) {
            const validation = await validateEmail(email);
            if (validation.isValid) return email;
        }

        return '';
    } catch (e) {
        return '';
    } finally {
        try { await page.close(); } catch (e) { }
    }
}

// Helper: Find website URL via DuckDuckGo (Fallback)
async function findWebsiteViaDuckDuckGo(browser, query) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        // DuckDuckGo is much friendlier to scrapers
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web&kl=us-en`, { waitUntil: 'domcontentloaded', timeout: 8000 });

        const firstLink = await page.evaluate(() => {
            // Selectors for DDG
            const badDomains = ['yelp', 'tripadvisor', 'facebook', 'instagram', 'linkedin', 'yellowpages', 'thumbtack', 'ubereats', 'deliveroo', 'just-eat', 'checkatrade', 'trustpilot'];

            // DDG uses data-testid="result-title-a" or class "result__a"
            let links = Array.from(document.querySelectorAll('[data-testid="result-title-a"], .result__a, .wLL07_0Xnd1QZpzpfR4W'));

            for (const a of links) {
                const href = a.href;
                if (!href || !href.startsWith('http')) continue;
                if (href.includes('duckduckgo.com')) continue;

                const isBad = badDomains.some(d => href.toLowerCase().includes(d));
                if (isBad) continue;

                return href;
            }
            return null;
        });

        if (!firstLink) console.log(`[DDG Fallback] No results found for: ${query}`);
        else console.log(`[DDG Fallback] Found: ${firstLink}`);

        return firstLink;
    } catch (e) {
        console.error(`[DDG Fallback] Error: ${e.message}`);
        return null;
    } finally {
        try { await page.close(); } catch (e) { }
    }
}

// Helper: Find website URL via Google Search
async function findWebsiteViaGoogle(browser, query) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`, { waitUntil: 'domcontentloaded', timeout: 8000 });

        // HANDLE CONSENT (Copied from main scraper)
        try {
            const consentSelectors = [
                'button[aria-label="Accept all"]',
                'button[aria-label="Agree to the use of cookies and other data for the purposes described"]',
                'form[action*="consent"] button',
                'div[role="dialog"] button:last-of-type'
            ];
            for (const selector of consentSelectors) {
                if (await page.$(selector)) {
                    await page.click(selector);
                    await page.waitForNavigation({ timeout: 5000 }).catch(() => { });
                    break;
                }
            }
        } catch (e) { }

        // Grab first organic result
        const firstLink = await page.evaluate(() => {
            const badDomains = ['yelp', 'tripadvisor', 'facebook', 'instagram', 'linkedin', 'yellowpages', 'thumbtack', 'ubereats', 'deliveroo', 'just-eat', 'checkatrade', 'trustpilot'];

            // Helper to check domains
            const isGoodLink = (href) => {
                if (!href || !href.startsWith('http')) return false;
                if (href.includes('google.com')) return false;
                if (badDomains.some(d => href.toLowerCase().includes(d))) return false;
                return true;
            };

            // Strategy 1: Standard 'g' class (Desktop)
            let results = Array.from(document.querySelectorAll('div.g a'));

            // Strategy 2: Mobile/Modern containers (data-hveid)
            if (!results.length) results = Array.from(document.querySelectorAll('div[data-hveid] a'));

            // Strategy 3: Nuclear Option (All main content links)
            if (!results.length) results = Array.from(document.querySelectorAll('#search a'));

            if (results.length === 0) {
                // DEBUG: Dump the first 500 chars of body text to see what page we are on
                const bodyText = document.body.innerText.substring(0, 500).replace(/\n/g, ' ');
                return `DEBUG_NO_RESULTS_FOUND (Title: ${document.title}) (Body: ${bodyText})`;
            }

            for (const a of results) {
                if (isGoodLink(a.href)) return a.href;
            }

            return `DEBUG_FILTERED_ALL: ${results.length} found (Title: ${document.title}). First: ${results[0]?.href}`;
        });

        if (firstLink && firstLink.startsWith('DEBUG_')) {
            console.log(`[Fallback Debug] Google Blocked/Failed (${firstLink}). Switch to DuckDuckGo...`);
            return await findWebsiteViaDuckDuckGo(browser, query);
        }

        return firstLink;
    } catch (e) {
        console.error(`[Fallback Debug] Error: ${e.message}`);
        return await findWebsiteViaDuckDuckGo(browser, query);
    } finally {
        try { await page.close(); } catch (e) { }
    }
}

// Helper: X-Ray Search LinkedIn via DuckDuckGo
async function scrapeDDGXRay(browser, companyName) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        const query = `site:linkedin.com/in "${companyName}" (CEO OR Founder OR Director)`;
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web&kl=us-en`, { waitUntil: 'domcontentloaded', timeout: 8000 });

        const profileLink = await page.evaluate(() => {
            let links = Array.from(document.querySelectorAll('[data-testid="result-title-a"], .result__a, .wLL07_0Xnd1QZpzpfR4W'));
            for (const a of links) {
                const href = a.href;
                if (!href || !href.startsWith('http')) continue;
                if (href.includes('linkedin.com/in/')) return href;
            }
            return null;
        });
        
        const profileName = await page.evaluate(() => {
            let elements = Array.from(document.querySelectorAll('[data-testid="result-title-a"], .result__a, .wLL07_0Xnd1QZpzpfR4W'));
            for (const el of elements) {
                const href = el.href;
                if (href && href.includes('linkedin.com/in/')) {
                    // Extract name from title (e.g. "John Doe - CEO - Company Name | LinkedIn")
                    const titleStr = el.innerText || '';
                    const parts = titleStr.split(' - ');
                    return parts[0] ? parts[0].trim() : null;
                }
            }
            return null;
        });

        if (profileLink) {
            console.log(`[DDG X-Ray] Found LinkedIn Profile: ${profileLink} (${profileName})`);
            return { link: profileLink, name: profileName };
        }
        return null;
    } catch (e) {
        console.error(`[DDG X-Ray] Error: ${e.message}`);
        return null;
    } finally {
        try { await page.close(); } catch (e) { }
    }
}

// Helper: Fetch with retry (no rate limiting needed for Gemini)
function fetchWithRateLimit(url, options, maxRetries = 3) {
    const log = console.log;

    return (async () => {
        for (let i = 0; i <= maxRetries; i++) {
            try {
                const response = await fetch(url, options);

                if (response.status === 429) {
                    const waitTime = 2000 * (i + 1); // Simple backoff
                    log(`API Rate Limit (429). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                return response;
            } catch (error) {
                if (i === maxRetries) throw error;
                log(`Network error: ${error.message}. Retrying... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        throw new Error('Max retries exceeded for API call');
    })();
}

// Helper: Generate AI Summary with Deep Research - Enhanced Investigative Journalist Prompt
async function generateAISummary(text, notesContext = '', isDeepResearch = true) {
    const log = console.log;
    try {
        if (!text || text.length < 5) {
            log('GENERATE_AI_SUMMARY: Text too short, returning generic fallback.');
            return "## ⚡ Quick Summary\nUnable to generate summary due to insufficient data.\n\n## 🔬 Deep Research\nNo deep research available.";
        }

        log(`GENERATE_AI_SUMMARY: Generating summary for text length: ${text.length}, deepResearch: ${isDeepResearch}`);

        // Use AI to generate a high quality summary - Investigative Journalist mode
        const prompt = `You are an elite investigative business intelligence journalist. Your task is to produce a comprehensive "Deep Dive" business analysis report on the target company based on the scraped web data below.

CRITICAL INSTRUCTIONS:
1. Act as a detective analyzing the company's digital footprint.
2. Identify their **niche specialization** — exactly what makes them unique in their market.
3. Identify **Bleeding Business Signals** (Pain Points) — what is broken, missing, or suboptimal on their website, bad reviews, or poor social presence.
4. Analyze **Growth Signals & Revenue Levers** — how they make money and how they could optimize.
5. Provide **Tech Stack & Services** — what they use and what they offer.
6. Pay special attention to the [EXTERNAL_INTEL_SOCIAL] section. Summarize their social media presence, recent reviews, or public perception.
7. The conversation starter should be 1-2 sentences, curiosity-driven, and reference a specific detail from their website or social media.

RAW DATA:
${text.substring(0, 75000)}

Format your response EXACTLY as follows (using markdown):

## ⚡ Quick Fact
[1 sentence quick fact about them]

## 🎯 Personalised Detail
[1 sentence highly personalized detail about their founders or company history]

## 🏢 Company Overview
[2-3 concise sentences summarizing the company and its key value proposition]

## 🚨 Bleeding Business Signals (Pain Points)
- **[Area 1]**: [Description of what is broken or missing]
- **[Area 2]**: [Description of bad reviews or poor UX]

## 📈 Growth Signals & Revenue Levers
- **[Signal 1]**: [How they can grow]
- **[Signal 2]**: [Revenue opportunities]

## 💻 Tech Stack & Services
- [Service/Tech 1]
- [Service/Tech 2]

## 🌐 Reputation & Social
[Summarize their reviews, ratings, and social media presence]

## 💬 Conversation Starter
> "[Your curiosity-driven conversation starter referencing a specific detail]"`;

        try {
            const aiRes = await fetchAIChatCompletion({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                model: 'deepseek-v4-flash',
                max_tokens: 1024
            });
            
            if (aiRes && aiRes.choices && aiRes.choices[0]) {
                const content = aiRes.choices[0].message.content;
                // Validate that the deep dive contains required sections
                const hasBleedingSection = content.includes('Bleeding') || content.includes('Pain');
                const hasGrowthSection = content.includes('Growth') || content.includes('Revenue');
                const hasTechSection = content.includes('Tech') || content.includes('Services');
                
                if (isDeepResearch && (!hasBleedingSection || !hasGrowthSection || !hasTechSection)) {
                    log('GENERATE_AI_SUMMARY: Deep dive missing required sections, marking as incomplete.');
                    return content + '\n\n⚠️ **Research Note**: This report may be incomplete. Critical sections (Bleeding Business Signals, Growth Signals, or Tech Stack) were not fully generated.';
                }
                
                return content;
            }
            throw new Error('Invalid AI response format');
        } catch (outerErr) {
            console.error('Outer Summary Generation Error:', outerErr);
            return `## ⚡ Quick Summary\nError: ${outerErr.message}\n\n## 🔬 Deep Research\nFailed.`;
        }
    } catch (e) {
        console.error('Outer Summary Generation Error:', e);
        return `## ⚡ Quick Summary\nError: ${e.message}\n\n## 🔬 Deep Research\nFailed.`;
    }
}

// Helper: Gather External Intel (Google Search for People/Socials) to append to context
async function gatherExternalIntel(browser, companyName) {
    if (!companyName) return '';
    let extraData = '';

    // Run both intel searches in PARALLEL
    const [peopleResult, socialResult] = await Promise.allSettled([
        (async () => {
            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                const query = `${companyName} CEO founder owner team linkedin`;
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`, { waitUntil: 'domcontentloaded', timeout: 8000 });
                const searchResults = await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('div.g')).slice(0, 5);
                    return els.map(el => el.innerText).join('\n---\n');
                });
                return `\n[EXTERNAL_INTEL_PEOPLE]:\n${searchResults}\n`;
            } catch (e) { return ''; }
            finally { try { await page.close(); } catch (e) { } }
        })(),
        (async () => {
            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                const querySocial = `${companyName} reviews social media facebook instagram twitter`;
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(querySocial)}&gl=us&hl=en`, { waitUntil: 'domcontentloaded', timeout: 8000 });
                const searchResults = await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('div.g')).slice(0, 5);
                    return els.map(el => el.innerText).join('\n---\n');
                });
                return `\n[EXTERNAL_INTEL_SOCIAL]:\n${searchResults}\n`;
            } catch (e) { return ''; }
            finally { try { await page.close(); } catch (e) { } }
        })()
    ]);

    if (peopleResult.status === 'fulfilled') extraData += peopleResult.value;
    if (socialResult.status === 'fulfilled') extraData += socialResult.value;

    return extraData;
}

// FIXED WEBSITE SCRAPER
async function scrapeWebsite(browser, url, log = console.log, notesContext = '', deepResearch = false, companyNameOverride = '') {
    const page = await browser.newPage();
    const data = { 
        email: '', 
        phone: '', 
        summary: '', 
        social: { twitter: '', facebook: '', instagram: '', linkedin: '', tiktok: '' },
        tech_stack: [],
        services_offered: []
    };

    // Aggregated text for AI summary
    let aggregatedText = '';
    const allFoundEmails = new Set();

    // Junk filter for scraper (same as validation)
    const JUNK_LOCAL_PARTS = new Set([
        'wght', 'width', 'height', 'size', 'color', 'background', 'url', 'src',
        'href', 'image', 'img', 'icon', 'logo', 'svg', 'png', 'jpg', 'jpeg',
        'domain', 'user', 'name', 'firstname', 'lastname', 'email'
    ]);

    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // --- ATTEMPT WEBSITE VISIT ---
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

            // 2. COOKIE ACCEPTANCE
            const handleCookieBanner = async (p) => {
                try {
                    const selectors = [
                        '#onetrust-accept-btn-handler',
                        'button[id*="accept"]',
                        'button[class*="accept"]',
                        'a[class*="accept"]',
                        'button[aria-label*="Agree"]',
                        'button[aria-label*="Accept"]',
                        'button:contains("Accept")',
                        'button:contains("Allow All")',
                        'div[role="dialog"] button:first-of-type'
                    ];

                    const accepted = await p.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, a'));
                        const acceptBtn = buttons.find(b => {
                            const t = b.innerText.toLowerCase();
                            return (t.includes('accept') || t.includes('agree') || t.includes('allow all') || t === 'ok' || t.includes('akzeptieren') || t.includes('zustimmen'))
                                && !t.includes('show') && !t.includes('manage');
                        });
                        if (acceptBtn) {
                            acceptBtn.click();
                            return true;
                        }
                        return false;
                    });

                    if (accepted) {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                } catch (e) { }
            };

            await handleCookieBanner(page);
            await autoScroll(page);

            // 3. Extract Core Data (Helper)
            const extractContacts = async (p) => {
                const content = await p.content();
                const found = new Set();

                // Get ALL mailto links
                const mailtos = await p.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                        .map(a => a.href.replace('mailto:', '').split('?')[0]);
                });
                mailtos.forEach(e => found.add(e.toLowerCase()));

                // Improved Regex Search in Body and complete HTML
                const text = await p.evaluate(() => document.body.innerText);
                const htmlContent = content; // from await p.content() above
                
                // Catch standard and obfuscated emails
                const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
                
                const htmlMatches = htmlContent.match(emailRegex) || [];
                const textMatches = text.match(emailRegex) || [];

                [...htmlMatches, ...textMatches].forEach(e => found.add(e.toLowerCase()));

                // Obfuscation bypass regex: matches "hello [at] domain [dot] com", "hello at domain dot com", "hello(at)domain.com", etc.
                const obfRegex = /([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|@|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\.|\s+dot\s+)\s*([a-zA-Z]{2,6})/gi;
                
                let match;
                while ((match = obfRegex.exec(text)) !== null) {
                    const candidate = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
                    found.add(candidate);
                }
                while ((match = obfRegex.exec(htmlContent)) !== null) {
                    const candidate = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
                    found.add(candidate);
                }

                // Filter Logic
                const validEmails = [...found].filter(e => {
                    if (e.match(/\.(png|jpg|svg|css|js|webp)$/i)) return false;
                    if (e.includes('example') || e.includes('sentry') || e.includes('wixpress')) return false;
                    if (e.match(/@\d+\.\d+\.\d+/)) return false; // IP address domain

                    const localPart = e.split('@')[0];
                    if (JUNK_LOCAL_PARTS.has(localPart)) return false;

                    return true;
                });

                // Phone (Prioritize US formats)
                let phone = '';
                const usPhones = content.match(/(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
                const intlPhones = content.match(/(?:\+?\d{1,3}[-. ]?)?\(?\d{2,4}\)?[-. ]?\d{3,4}[-. ]?\d{3,4}/g) || [];
                
                if (usPhones.length) phone = usPhones[0];
                else if (intlPhones.length) phone = intlPhones[0];

                // Socials
                const social = { twitter: '', facebook: '', instagram: '', linkedin: '', tiktok: '' };
                const hrefs = await p.$$eval('a', as => as.map(a => {
                    if (typeof a.href === 'string') return a.href;
                    if (a.href && typeof a.href === 'object' && typeof a.href.baseVal === 'string') return a.href.baseVal;
                    return '';
                }).filter(Boolean));
                hrefs.forEach(href => {
                    if (typeof href !== 'string') return;
                    if (href.includes('facebook.com') && !href.includes('sharer')) social.facebook = href;
                    if (href.includes('twitter.com') || href.includes('x.com')) social.twitter = href;
                    if (href.includes('instagram.com')) social.instagram = href;
                    if (href.includes('linkedin.com/in') || href.includes('linkedin.com/company')) social.linkedin = href;
                    if (href.includes('tiktok.com')) social.tiktok = href;
                });

                // Text for AI
                const rawText = await p.evaluate(() => {
                    const clone = document.body.cloneNode(true);
                    clone.querySelectorAll('nav, footer, script, style, noscript, iframe, svg, .cookie-banner, #onetrust-banner-sdk').forEach(b => b.remove());
                    return clone.innerText.replace(/\s+/g, ' ').trim();
                });

                // NATIVE EXTRACTION WITHOUT AI:
                let techStack = [];
                let services = [];
                try {
                    techStack = detectTechStackFromHtml(htmlContent);
                    const $ = cheerio.load(htmlContent);
                    services = extractServicesFromHtml($, htmlContent);
                } catch (e) { }

                return { emails: validEmails, phone: formatPhoneNumber(phone), social, text: rawText, techStack, services };
            };

            // --- SCAN HOME PAGE ---
            const homeData = await extractContacts(page);
            homeData.emails.forEach(e => allFoundEmails.add(e));
            if (homeData.phone) data.phone = homeData.phone;
            Object.assign(data.social, homeData.social);
            if (homeData.techStack) data.tech_stack = [...new Set([...data.tech_stack, ...homeData.techStack])];
            if (homeData.services) data.services_offered = [...new Set([...data.services_offered, ...homeData.services])];
            aggregatedText += ` [HOME PAGE]: ${homeData.text.substring(0, 1500)} \n`;

            // 4. DEEP CRAWL: Visit key pages
            const subPageKeywords = ['contact', 'about', 'support', 'team', 'mission', 'story', 'services', 'get-in-touch', 'help', 'legal', 'privacy', 'reach-us', 'locations'];
            const subLinks = await page.$$eval('a', (as, keywords) => {
                const links = as.map(a => {
                    if (typeof a.href === 'string') return a.href;
                    if (a.href && typeof a.href === 'object' && typeof a.href.baseVal === 'string') return a.href.baseVal;
                    return '';
                })
                    .filter(Boolean)
                    .filter(h => h.startsWith('http') && !h.match(/\.(jpg|jpeg|png|gif|svg|pdf)$/i))
                    .filter((v, i, a) => a.indexOf(v) === i); // unique

                // Prioritize links based on the keyword index (lower index = higher priority)
                return links.map(link => {
                    const l = link.toLowerCase();
                    let score = keywords.findIndex(k => l.includes(k));
                    return { link, score: score >= 0 ? score : 999 };
                })
                    .filter(x => x.score < 999)
                    .sort((a, b) => a.score - b.score)
                    .map(x => x.link);
            }, subPageKeywords);

            const uniqueLinks = [...new Set(subLinks)].slice(0, 3); // Scan up to 3 highly relevant subpages (reduced from 5 for performance)

            // SEQUENTIAL sub-page crawling — REUSE the main page tab to save memory
            for (const link of uniqueLinks) {
                try {
                    if (link === url) continue;

                    // Navigate the existing page instead of opening a new tab
                    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 8000 });
                    await handleCookieBanner(page);

                    const subData = await extractContacts(page);

                    // Collect emails
                    subData.emails.forEach(e => allFoundEmails.add(e));

                    // Merge other missing info
                    if (!data.phone && subData.phone) data.phone = subData.phone;
                    Object.keys(subData.social).forEach(k => {
                        if (!data.social[k] && subData.social[k]) data.social[k] = subData.social[k];
                    });
                    if (subData.techStack) data.tech_stack = [...new Set([...data.tech_stack, ...subData.techStack])];
                    if (subData.services) data.services_offered = [...new Set([...data.services_offered, ...subData.services])];

                    let pageType = 'PAGE';
                    if (link.includes('about')) pageType = 'ABOUT US';
                    else if (link.includes('contact')) pageType = 'CONTACT';
                    else if (link.includes('menu')) pageType = 'MENU';

                    aggregatedText += ` [${pageType}]: ${subData.text.substring(0, 800)} \n`;
                } catch (err) { }
            }

            // 5. Select Best Email
            if (allFoundEmails.size > 0) {
                const emailList = Array.from(allFoundEmails);

                // Freshness Check: Look for current/recent year in aggregated text
                const currentYear = new Date().getFullYear();
                const textLower = aggregatedText.toLowerCase();
                const yearMatch = textLower.match(/©\s*(20\d{2})|copyright\s*(20\d{2})/);
                if (yearMatch) {
                    const siteYear = parseInt(yearMatch[1] || yearMatch[2]);
                    if (siteYear < currentYear - 2) {
                        log(`Warning: Website ${url} might be outdated (Copyright ${siteYear})`);
                        // We don't drop it yet, but it's a negative signal.
                    }
                }

                // IMPROVED EMAIL PRIORITIZATION
                // 1. Personal Names (e.g. john.doe@, s.smith@)
                // 2. Direct Contact (contact@, hello@, hi@)
                // 3. Information (info@)
                // 4. Admin/Office (office@, admin@)
                // 5. Generic/Catch-all (others)
                
                const priorityPrefixes = ['contact', 'hello', 'hi', 'welcome', 'info', 'office', 'admin'];
                
                emailList.sort((a, b) => {
                    const aLocal = a.split('@')[0].toLowerCase();
                    const bLocal = b.split('@')[0].toLowerCase();
                    
                    // Check for personal names (usually have a dot or are long and not in priority list)
                    const isPersonal = (local) => {
                        return local.includes('.') || (local.length > 4 && !priorityPrefixes.includes(local));
                    };

                    const aPrio = isPersonal(aLocal) ? 0 : (priorityPrefixes.indexOf(aLocal) !== -1 ? priorityPrefixes.indexOf(aLocal) + 1 : 100);
                    const bPrio = isPersonal(bLocal) ? 0 : (priorityPrefixes.indexOf(bLocal) !== -1 ? priorityPrefixes.indexOf(bLocal) + 1 : 100);
                    
                    return aPrio - bPrio;
                });

                // Verify emails before accepting
                for (const email of emailList) {
                    // Skip if obviously invalid regex (already filtered but double check)
                    const validation = await validateEmail(email);
                    if (validation.isValid) {
                        data.email = email;
                        break;
                    }
                }
            }
        } catch (webError) {
            log(`Website visit failed partially: ${webError.message}`);
            aggregatedText += `\n[WEBSITE_ERROR]: Could not access fully (${webError.message}). Using external data for analysis.\n`;
        }

        // 6. Final AI Summary (DEEP RESEARCH MODE)
        const pageTitle = await page.evaluate(() => document.title).catch(() => companyNameOverride || '');
        const companyName = companyNameOverride || pageTitle || (url ? new URL(url).hostname : 'Unknown Company');

        // CONDITIONAL DEEP RESEARCH
        let externalIntel = '';
        if (deepResearch) {
            log('Gathering external intel (CEO/Socials)...');
            externalIntel = await gatherExternalIntel(browser, companyName);
            aggregatedText += externalIntel;
            
            if (aggregatedText.length > 20 || externalIntel.length > 20) {
                log('Generating AI Report...');
                try {
                    const res = await generateStructuredResearchFromText(aggregatedText, companyName, url, { company: companyName }, log, notesContext);
                    data.summary = res.summary;
                    data.structured = res.structured;
                } catch (e) {
                    log(`AI Report generation failed: ${e.message}`);
                    data.summary = `## ⚡ Quick Summary\nError generating report: ${e.message}\n\n## 🔬 Deep Research\nProcess failed.`;
                    data.structured = {};
                }
            } else {
                log('Data too sparse for normal research. Attempting minimal AI research.');
                try {
                    const res = await generateStructuredResearchFromText(`Company Name: ${companyName}\nSource: Minimal data found.`, companyName, url, { company: companyName }, log, notesContext);
                    data.summary = res.summary;
                    data.structured = res.structured;
                } catch (e) {
                    log(`Minimal AI Report generation failed: ${e.message}`);
                    data.summary = `## ⚡ Quick Summary\nMinimal report error: ${e.message}\n\n## 🔬 Deep Research\nProcess failed.`;
                    data.structured = {};
                }
            }
        } else {
            // Bypass AI to save tokens and time
            const shortDesc = aggregatedText.substring(0, 300).replace(/\n/g, ' ').trim();
            data.summary = shortDesc ? `Found context: ${shortDesc}...` : "No summary generated (Fast mode).";
        }

        log(`Final Summary Length: ${data.summary.length}`);

    } catch (e) {
        log(`ScrapeWebsite Fatal Error: ${e.message}`);
        if (!data.summary) {
            data.summary = `## ⚡ Quick Summary\nSystem error during research: ${e.message}\n\n## 🔬 Deep Research\nProcess failed.`;
        }
    } finally {
        try { await page.close(); } catch (e) { }
    }
    return data;
}

// Fetch from Crawl4AI Docker container
export async function fetchCrawl4AI(url, log) {
    try {
        log(`[Crawl4AI] Sending extraction request for ${url}`);
        const response = await fetch('http://127.0.0.1:11225/crawl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                urls: url,
                word_count_threshold: 10,
                extract_blocks: true,
                screenshot: false
            })
        });

        if (!response.ok) {
            throw new Error(`Crawl4AI HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // The /crawl endpoint usually returns { results: [{ markdown: "..." }] }
        if (data.results && data.results.length > 0 && data.results[0].markdown) {
            return data.results[0].markdown;
        } else if (data.markdown) {
            return data.markdown;
        } else if (data.text) {
             return data.text;
        }
        
        throw new Error('No markdown or text found in Crawl4AI response');
    } catch (e) {
        log(`[Crawl4AI] Extraction failed: ${e.message}`);
        return null;
    }
}

// Deep Research Function
export async function performDeepResearch(company, website, notesContext = '') {
    const log = console.log;
    log(`Starting Deep Research for ${company} (${website}) using Crawl4AI (Docker) & Camoufox...`);

    const setup = await setupBrowser(log);
    const browser = setup.browser;

    try {
        let aggregatedData = `Company: ${company}\nWebsite: ${website}\nUser Context: ${notesContext}\n\n`;

        // 1. Scrape Website Deeply using Crawl4AI, fallback to Camoufox
        if (website && website.startsWith('http')) {
            try {
                let pageText = null;
                
                // Attempt Crawl4AI First
                pageText = await fetchCrawl4AI(website, log);
                
                if (pageText) {
                    log(`[Crawl4AI] Success! Extracted ${pageText.length} chars.`);
                    aggregatedData += `[WEBSITE_HOME (Crawl4AI)]:\n${pageText.substring(0, 75000)}\n\n`;
                } else {
                    log(`[Crawl4AI] Failed or skipped. Falling back to Camoufox...`);
                    const page = await browser.newPage();
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    log(`[Camoufox] Scraping homepage: ${website}`);
                    await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    
                    pageText = await page.evaluate(() => {
                        return document.body ? document.body.innerText : '';
                    });
                    
                    if (pageText) {
                        aggregatedData += `[WEBSITE_HOME (Camoufox)]:\n${pageText.substring(0, 75000)}\n\n`;
                    } else {
                        aggregatedData += `[WEBSITE_ERROR]: Could not extract text from website.\n`;
                    }
                    
                    await page.close();
                }
            } catch (e) {
                log(`Website scrape error: ${e.message}`);
                aggregatedData += `[WEBSITE_ERROR]: Could not access website fully.\n`;
            }
        }

        // 2. Search for CEO/Key People via Google
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Search: People + LinkedIn
            const query = `${company} CEO founder owner director team linkedin`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const searchResults = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('div.g')).map(el => el.innerText).slice(0, 6).join('\n---\n');
            });
            aggregatedData += `[GOOGLE_SEARCH_PEOPLE]:\n${searchResults}\n\n`;

            // Search: Reviews + Social presence
            const querySocial = `${company} reviews social media facebook instagram twitter`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(querySocial)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const socialResults = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('div.g')).map(el => el.innerText).slice(0, 6).join('\n---\n');
            });
            aggregatedData += `[GOOGLE_SEARCH_SOCIAL]:\n${socialResults}\n\n`;

            // Search: Google Maps for rating + reviews count
            try {
                const mapsQuery = `${company} google reviews rating`;
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(mapsQuery)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const ratingsData = await page.evaluate(() => {
                    // Look for the star rating and review count in Google's knowledge panel
                    const ratingEl = document.querySelector('[data-attrid="kc:/collection/knowledge_panels/has_star_rating:star_rating"]') ||
                                     document.querySelector('.Aq14fc') ||
                                     document.querySelector('[aria-label*="stars"]') ||
                                     document.querySelector('[aria-label*="rating"]');
                    const reviewEl = document.querySelector('[data-attrid="kc:/collection/knowledge_panels/has_star_rating:star_rating"] + span') ||
                                     document.querySelector('.hqzQac');
                    
                    const bodyText = document.body.innerText.substring(0, 2000);
                    const ratingMatch = bodyText.match(/(\d+[,.]?\d*)\s*(?:out of 5|stars?|Sterne?|★)/i);
                    const reviewMatch = bodyText.match(/(\d[\d,.]*)\s*(?:reviews?|Rezensionen?|Google reviews?|Google Rezensionen?)/i);
                    
                    return {
                        rating: ratingEl?.textContent || (ratingMatch ? ratingMatch[1] : null),
                        reviews: reviewEl?.textContent || (reviewMatch ? reviewMatch[1] : null),
                        snippet: bodyText.substring(0, 500)
                    };
                });
                if (ratingsData.rating || ratingsData.reviews) {
                    aggregatedData += `[GOOGLE_REVIEWS]:\nRating: ${ratingsData.rating || 'N/A'}\nReviews: ${ratingsData.reviews || 'N/A'}\n${ratingsData.snippet}\n\n`;
                }
            } catch (e) {
                log(`Google reviews search error: ${e.message}`);
            }

            // Search: Recent news
            try {
                const newsQuery = `"${company}" news recent`;
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(newsQuery)}&tbm=nws`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const newsResults = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('div.SoaBEf, div.WlydOe, article')).map(el => el.innerText).slice(0, 5).join('\n---\n');
                });
                if (newsResults && newsResults.trim()) {
                    aggregatedData += `[GOOGLE_NEWS]:\n${newsResults}\n\n`;
                }
            } catch (e) {
                log(`Google News search error: ${e.message}`);
            }

            // Search: Public LinkedIn Posts (No Cookies/Google Dork method)
            try {
                const linkedinQuery = `site:linkedin.com/posts/ "${company}"`;
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(linkedinQuery)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const linkedinPosts = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('div.g')).map(el => el.innerText).slice(0, 5).join('\n---\n');
                });
                if (linkedinPosts && linkedinPosts.trim()) {
                    aggregatedData += `[LINKEDIN_PUBLIC_POSTS]:\n${linkedinPosts}\n\n`;
                }
            } catch (e) {
                log(`LinkedIn posts search error: ${e.message}`);
            }

            // Search: Public Facebook Posts (No Cookies/Google Dork method)
            try {
                const facebookQuery = `site:facebook.com "${company}" posts`;
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(facebookQuery)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const facebookPosts = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('div.g')).map(el => el.innerText).slice(0, 5).join('\n---\n');
                });
                if (facebookPosts && facebookPosts.trim()) {
                    aggregatedData += `[FACEBOOK_PUBLIC_POSTS]:\n${facebookPosts}\n\n`;
                }
            } catch (e) {
                log(`Facebook posts search error: ${e.message}`);
            }

            await page.close();
        } catch (e) {
            log(`Google search error: ${e.message}`);
        }

        const report = `
### Deep Research Report for ${company}

**1. Executive Summary & Website Data**
${aggregatedData}

*Note: This data was collected automatically via the deep research scraper.*
`;
        return report;
    } catch (e) {
        log(`Deep Research Error: ${e.message}`);
        return `Failed to perform deep research: ${e.message}`;
    } finally {
        await safeBrowserClose(browser);
    }
}

// Hermes Autonomous Scraper
export async function scrapeWithHermes(query, limit = 10, onLog = null, onResult = null) {
    const log = createLogger(onLog);
    log(`[Hermes] Starting autonomous AI scrape for: ${query}`);
    
    // Paths to Hermes installation
    const pythonPath = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe";
    const hermesPath = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent\\hermes";
    
    // We use a structured prompt to force JSON output
    const prompt = `Act as a lead generation expert. Your task is to find ${limit} leads for the following niche: "${query}". 
    Use your browser tool to find company names, websites, and contact emails. 
    Focus on finding REAL contact data.
    Output the results ONLY as a JSON array of objects with the following fields: company, website, email, phone, summary.
    Do not include any other text in your response, just the raw JSON array.`;

    try {
        if (!fs.existsSync(pythonPath)) {
            log(`[Hermes Error]: Hermes agent is not installed on this server environment.`);
            return [];
        }
        log(`[Hermes] Triggering autonomous agent...`);
        // We use --yolo to let it run without constant confirmation, and -z for one-shot scripting mode
        const { stdout, stderr } = await execPromise(`"${pythonPath}" "${hermesPath}" -z "${prompt}" --yolo`);
        
        if (stderr && !stdout) {
            log(`[Hermes Error]: ${stderr}`);
            return [];
        }

        // Search for JSON block in the output
        const jsonMatch = stdout.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
            try {
                const leads = JSON.parse(jsonMatch[0]);
                log(`[Hermes] Agent successfully returned ${leads.length} leads.`);
                
                // Map to our standard lead format
                const formattedLeads = leads.map(l => ({
                    id: `hermes-${Math.random().toString(36).substr(2, 9)}`,
                    name: '',
                    status: 'New',
                    company: l.company || 'Unknown',
                    email: l.email || '',
                    phone: l.phone || '',
                    website: l.website || '',
                    summary: l.summary || '',
                    role: '',
                    twitter: '', facebook: '', instagram: '', linkedin: '', tiktok: '',
                    location: query.split(' in ')[1] || 'Unknown',
                    source: 'Hermes Agent'
                }));

                if (onResult) {
                    for (const lead of formattedLeads) {
                        onResult(lead).catch(() => {});
                    }
                }
                return formattedLeads;
            } catch (parseErr) {
                log(`[Hermes] JSON Parse Error: ${parseErr.message}`);
                return [];
            }
        } else {
            log(`[Hermes] Agent did not return a valid JSON array. Check logs.`);
            return [];
        }
    } catch (e) {
        log(`[Hermes Exception]: ${e.message}`);
        return [];
    }
}

// Companies House Scraper
export async function scrapeCompaniesHouse(query, limit = 20, onLog = null, onResult = null, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting Companies House scraper for: ${query}`);

    let companies = [];
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

    if (apiKey) {
        log(`Using official Companies House REST API for fast retrieval...`);
        try {
            const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
            const fetchLimit = Math.min(limit, 100); 
            const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=${fetchLimit}`;
            
            const res = await fetch(searchUrl, {
                headers: { 'Authorization': authHeader }
            });

            if (res.ok) {
                const data = await res.json();
                companies = (data.items || []).map(item => ({
                    company: item.title,
                    companyNumber: item.company_number,
                    address: item.address_snippet || '',
                    meta: item.description || ''
                }));
                log(`API returned ${companies.length} companies instantly.`);
            } else {
                log(`API failed with status ${res.status}. Falling back to UI scraper...`);
            }
        } catch (e) {
            log(`API Error: ${e.message}. Falling back to UI scraper...`);
        }
    }

    let setup;
    let browser;
    let usedBrowser = false;
    
    try {
        setup = await setupBrowser(log);
        browser = setup.browser;
        usedBrowser = true;
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        if (companies.length === 0) {
            log(`No API results. Using UI scraper for Companies House...`);
            const searchUrl = `https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}`;
            log(`Navigating to Companies House search: ${searchUrl}`);
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Extract company search items
            companies = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('li.results-item')).map(li => {
                    const titleEl = li.querySelector('h3 a');
                    const metaText = li.querySelector('p.meta')?.innerText || '';
                    const addressEl = li.querySelector('p.meta + p') || li.querySelector('p:not(.meta)');
                    return {
                        company: titleEl?.innerText?.trim() || '',
                        companyNumber: titleEl?.href?.split('/company/')?.[1]?.trim() || '',
                        address: addressEl?.innerText?.trim() || '',
                        meta: metaText
                    };
                }).filter(c => c.company);
            });
            log(`Extracted ${companies.length} companies from Companies House UI.`);
        }

        const leads = [];

        for (const item of companies) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            log(`Processing company: ${item.company} (No: ${item.companyNumber})`);

            // Fetch extra filing details from Companies House API for revenue & year founded
            let extraDetails = '';
            const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
            if (apiKey && item.companyNumber) {
                try {
                    const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
                    const profileUrl = `https://api.company-information.service.gov.uk/company/${item.companyNumber}`;
                    const profileRes = await fetch(profileUrl, {
                        headers: { 'Authorization': authHeader }
                    });
                    if (profileRes.ok) {
                        const profile = await profileRes.json();
                        const founded = profile.date_of_creation ? profile.date_of_creation.split('-')[0] : '';
                        const accountsType = profile.accounts?.last_accounts?.type || '';
                        
                        let revenueEst = null;
                        let sizeEst = null;
                        if (accountsType === 'micro-entity' || accountsType === 'dormant') {
                            revenueEst = 'Under £632,000';
                            sizeEst = '1-10 employees';
                        } else if (accountsType === 'small' || accountsType === 'total-exemption-full') {
                            revenueEst = '£632,000 - £10.2 Million';
                            sizeEst = '11-50 employees';
                        } else if (accountsType === 'medium' || accountsType === 'full' || accountsType === 'audited-full') {
                            revenueEst = '£10.2 Million - £36 Million';
                            sizeEst = '51-250 employees';
                        } else if (accountsType === 'large') {
                            revenueEst = 'Over £36 Million';
                            sizeEst = 'Over 250 employees';
                        }

                        if (profile.registered_office_address) {
                            const ro = profile.registered_office_address;
                            const addrParts = [ro.address_line_1, ro.address_line_2, ro.locality, ro.postal_code, ro.country || 'United Kingdom'].filter(Boolean);
                            if (addrParts.length > 0) {
                                item.address = addrParts.join(', ');
                            }
                        }

                        extraDetails = `\n- Year Founded: ${founded}\n- Accounts Filing Type: ${accountsType}\n- Estimated Revenue: ${revenueEst || 'Unknown'}\n- Estimated Company Size: ${sizeEst || 'Unknown'}`;
                        item.year_founded = founded;
                        item.annual_revenue = revenueEst;
                        item.company_size = sizeEst;
                    }
                } catch (e) {
                    log(`Error fetching profile from Companies House: ${e.message}`);
                }
            }

            // Ensure address has pin formatting and filter out mismatched UK cities
            item.address = formatLocation(item.address);
            const majorCities = ['london', 'manchester', 'sheffield', 'birmingham', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'liverpool', 'newcastle', 'york', 'cardiff', 'belfast', 'nottingham'];
            const queryLow = query.toLowerCase();
            const targetCity = majorCities.find(city => queryLow.includes(city));
            if (targetCity && item.address) {
                const addrLow = item.address.toLowerCase();
                const foundWrongCity = majorCities.find(city => city !== targetCity && addrLow.includes(city));
                if (foundWrongCity && !addrLow.includes(targetCity)) {
                    log(`[Location Filter] Skipping ${item.company} located in ${foundWrongCity}, query requested ${targetCity}.`);
                    continue;
                }
            }

            // Step 1: Search website via DuckDuckGo
            try {
                const searchQuery = `${item.company} ${item.address} official website`;
                const website = await findWebsiteViaDuckDuckGo(browser, searchQuery);

                if (website && website.startsWith('http')) {
                    log(`Found website: ${website}. Scraping details...`);
                    const webData = await scrapeWebsite(browser, website, log, '', false, item.company);

                    const lead = {
                        id: `ch-${item.companyNumber || Math.random().toString(36).substr(2, 9)}`,
                        status: 'New',
                        source: 'Companies House',
                        company: item.company,
                        website: website,
                        email: webData.email || '',
                        phone: webData.phone || item.phone || '',
                        location: item.address || formatLocation(query),
                        year_founded: item.year_founded || null,
                        annual_revenue: item.annual_revenue || null,
                        company_size: item.company_size || null,
                        summary: `## ⚡ Quick Summary\nOfficial UK registered company found on Companies House (Number: ${item.companyNumber || 'N/A'}). Status: Active.\n\n## 🔬 Deep Research\n- Registered Address: ${item.address || 'N/A'}\n- Website: ${website}\n- Identified details: ${item.meta}${extraDetails}`
                    };

                    leads.push(lead);
                    if (onResult) {
                        onResult(lead).catch(err => log(`Error in onResult callback (Companies House): ${err.message}`));
                    }
                } else {
                    log(`Could not find official website for ${item.company}`);
                }
            } catch (e) {
                log(`Error processing ${item.company}: ${e.message}`);
            }
        }

        return leads;
    } catch (error) {
        log(`Companies House Scraping Error: ${error.message}`);
        throw error;
    } finally {
        if (usedBrowser) await safeBrowserClose(browser);
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

// Bing Maps / Search Scraper
export async function scrapeBingMaps(query, limit = 20, onLog = null, onResult = null, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting Bing Maps / Local Search for: ${query}`);

    let setup;
    let browser;
    try {
        setup = await setupBrowser(log, { isMaps: true });
        browser = setup.browser;
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        log(`Navigating to Bing Search: ${bingUrl}`);
        await page.goto(bingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Extract Bing organic and local elements
        const results = await page.evaluate(() => {
            const items = [];
            // Parse local map cards if they exist on Bing
            const localCards = Array.from(document.querySelectorAll('.lscr_link, .b_address, .b_phone, .ent_sq'));
            for (const card of localCards) {
                const titleEl = card.querySelector('h2, h3, a') || card;
                const urlEl = card.querySelector('a[href^="http"]');
                if (titleEl && urlEl) {
                    items.push({
                        title: titleEl.innerText.trim(),
                        url: urlEl.href
                    });
                }
            }

            // Parse organic results
            const organic = Array.from(document.querySelectorAll('li.b_algo')).map(el => {
                const titleEl = el.querySelector('h2 a');
                const descEl = el.querySelector('.b_caption p, .b_snippet');
                return {
                    title: titleEl?.innerText || '',
                    url: titleEl?.href || '',
                    snippet: descEl?.innerText || ''
                };
            });

            return [...items, ...organic].filter(r => r.title && r.url && !r.url.includes('bing.com') && !r.url.includes('microsoft.com'));
        });

        // Deduplicate results by URL
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const r of results) {
            if (!seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                uniqueResults.push(r);
            }
        }

        log(`Found ${uniqueResults.length} unique leads from Bing.`);
        const leads = [];

        for (const item of uniqueResults) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            log(`Visiting Bing lead website: ${item.url}`);
            try {
                const webData = await scrapeWebsite(browser, item.url, log, '', false, item.title);

                const lead = {
                    id: `bing-${Math.random().toString(36).substr(2, 9)}`,
                    status: 'New',
                    source: 'Bing Search',
                    company: item.title || webData.company || 'Unknown',
                    website: item.url,
                    email: webData.email || '',
                    phone: webData.phone || '',
                    location: query.split(' in ')[1] || '',
                    summary: `## ⚡ Quick Summary\nScraped lead from Bing Local and Web search for "${query}".\n\n## 🔬 Deep Research\n- Website: ${item.url}\n- Snippet details: ${item.snippet || 'N/A'}`
                };

                leads.push(lead);
                if (onResult) {
                    onResult(lead).catch(err => log(`Error in onResult callback (Bing): ${err.message}`));
                }
            } catch (e) {
                log(`Error scraping website ${item.url}: ${e.message}`);
            }
        }

        return leads;
    } catch (error) {
        log(`Bing Scraping Error: ${error.message}`);
        throw error;
    } finally {
        await safeBrowserClose(browser);
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

// Yell.com Scraper
export async function scrapeYell(business, location, limit = 20, onLog = null, onResult = null, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting Yell.com scraper for: ${business} in ${location}`);

    let setup;
    let browser;
    try {
        setup = await setupBrowser(log);
        browser = setup.browser;
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const searchUrl = `https://www.yell.com/ucs/UcsSearchAction.do?keywords=${encodeURIComponent(business)}&location=${encodeURIComponent(location)}`;
        log(`Navigating to Yell.com search: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for results container or short timeout
        await page.waitForSelector('.businessCapsule', { timeout: 10000 }).catch(() => {});

        const companies = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.businessCapsule, article[class*="businessCapsule"], div[class*="businessCapsule"]')).map(el => {
                const nameEl = el.querySelector('h2.businessCapsule--title, h2.businessCapsule--name, [class*="businessCapsule--title"], h2 a, h2');
                const phoneEl = el.querySelector('.businessCapsule--telephone, [class*="telephoneNumber"], [itemprop="telephone"], a[data-category="Phone"]');
                const webEl = el.querySelector('a[itemprop="url"], a[data-category="Website"], a[href^="http"]:not([href*="yell.com"]):not([href*="google.com"]):not([href*="facebook.com"]):not([href*="twitter.com"]):not([href*="instagram.com"])');
                const addrEl = el.querySelector('.businessCapsule--address, [itemprop="address"], [class*="address"], span[class*="streetAddress"]');
                
                return {
                    company: nameEl?.innerText?.trim() || '',
                    phone: phoneEl?.innerText?.trim() || '',
                    website: webEl?.href || '',
                    address: addrEl?.innerText?.trim() || ''
                };
            }).filter(c => c.company);
        });

        log(`Extracted ${companies.length} businesses from Yell.com search.`);
        const leads = [];
        const toProcess = companies.slice(0, Math.min(companies.length, limit, 5));

        for (const item of toProcess) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            log(`Processing Yell business: ${item.company}`);

            let website = item.website;
            let webData = { email: '', phone: '', summary: '' };
            if (website && website.startsWith('http')) {
                log(`Visiting Yell business website: ${website}`);
                try {
                    webData = await scrapeWebsite(browser, website, log, '', false, item.company);
                } catch (e) {
                    log(`Error scraping website ${website}: ${e.message}`);
                }
            }

            const lead = {
                id: `yell-${Math.random().toString(36).substr(2, 9)}`,
                status: 'New',
                source: 'Yell.com',
                company: item.company,
                website: website || '',
                email: webData.email || '',
                phone: item.phone || webData.phone || '',
                location: item.address || location || '',
                summary: `## ⚡ Quick Summary\nOfficial local business found on Yell.com UK directory.\n\n## 🔬 Deep Research\n- Registered Address: ${item.address || 'N/A'}\n- Website: ${website || 'N/A'}\n- Phone: ${item.phone || 'N/A'}`
            };

            leads.push(lead);
            if (onResult) {
                onResult(lead).catch(err => log(`Error in onResult callback (Yell): ${err.message}`));
            }
        }

        return leads;
    } catch (error) {
        log(`Yell.com Scraping Error: ${error.message}`);
        throw error;
    } finally {
        if (browser) await browser.close();
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

// Indeed Scraper (via Google/DDG Search to bypass Cloudflare protection)
export async function scrapeIndeed(query, location, limit = 20, onLog = null, onResult = null, checkState = null) {
    const log = createLogger(onLog);
    log(`Starting Indeed scraper for: ${query} in ${location}`);

    let setup;
    let browser;
    try {
        setup = await setupBrowser(log);
        browser = setup.browser;
        const page = await browser.newPage();
        await applyResourceBlocker(page);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Target Indeed company and job pages on Google Search
        const searchQuery = `site:indeed.com/cmp/ OR site:indeed.com/q- "${query}" "${location}"`;
        log(`Navigating to Google Search for Indeed profiles: ${searchQuery}`);
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&gl=us&hl=en`, { waitUntil: 'networkidle2', timeout: 60000 });

        // Handle consent
        try {
            const consentSelectors = [
                'button[aria-label="Accept all"]',
                'button[aria-label="Agree to the use of cookies and other data for the purposes described"]',
                'form[action*="consent"] button',
                'div[role="dialog"] button:last-of-type'
            ];
            for (const selector of consentSelectors) {
                if (await page.$(selector)) {
                    await page.click(selector);
                    await page.waitForNavigation({ timeout: 5000 }).catch(() => { });
                    break;
                }
            }
        } catch (e) { }

        // Extract search links
        const results = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('div.g a'))
                .map(a => {
                    const titleEl = a.querySelector('h3');
                    return { href: a.href, title: titleEl ? titleEl.innerText : '' };
                })
                .filter(r => r.href && r.href.includes('indeed.com/'));
        });

        log(`Found ${results.length} Indeed search results on Google.`);
        const leads = [];

        for (const item of results) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            // Extract company name from URL slug or title
            let company = '';
            if (item.href.includes('/cmp/')) {
                const slug = item.href.split('/cmp/')[1]?.split('/')[0]?.split('?')[0];
                if (slug) company = decodeURIComponent(slug).replace(/-[a-f0-9]+$/i, '').replace(/-/g, ' ');
            }
            if (!company && item.title) {
                // E.g. "Software Engineer - Apple - London - Indeed.com"
                const parts = item.title.split(' - ');
                if (parts.length >= 2) company = parts[parts.length - 2];
            }
            if (!company) continue;

            company = company.trim();
            log(`Processing Indeed lead: ${company}`);

            // Find official website
            const website = await findWebsiteViaGoogle(browser, `${company} official website`);
            if (!website || !website.startsWith('http')) {
                log(`No website found for Indeed lead ${company}. Skipping.`);
                continue;
            }

            log(`Found website for ${company}: ${website}. Scraping contacts...`);
            let webData = { email: '', phone: '', summary: '' };
            try {
                webData = await scrapeWebsite(browser, website, log, '', false, company);
            } catch (e) {
                log(`Error scraping ${website}: ${e.message}`);
            }

            const lead = {
                id: `indeed-${Math.random().toString(36).substr(2, 9)}`,
                status: 'New',
                source: 'Indeed (via Google)',
                company: company,
                website: website,
                email: webData.email || '',
                phone: webData.phone || '',
                location: location || '',
                summary: `## ⚡ Quick Summary\nCompany discovered from job listings on Indeed.\n\n## 🔬 Deep Research\n- Company: ${company}\n- Website: ${website}\n- Phone: ${webData.phone || 'N/A'}`
            };

            leads.push(lead);
            if (onResult) {
                onResult(lead).catch(err => log(`Error in onResult callback (Indeed): ${err.message}`));
            }
        }

        return leads;
    } catch (error) {
        log(`Indeed Scraping Error: ${error.message}`);
        throw error;
    } finally {
        await safeBrowserClose(browser);
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

// Employer Websites Scraper
export async function scrapeEmployerWebsites(query, location, limit = 20, onLog = null, onResult = null, checkState = null) {
    const log = createLogger(onLog);
    const searchQuery = `"${query}" careers OR jobs OR vacancies "${location}" -site:indeed.com -site:linkedin.com -site:glassdoor.com -site:totaljobs.com -site:reed.co.uk -site:simplyhired.com`;
    log(`Starting Employer Websites search for: ${searchQuery}`);

    let setup;
    let browser;
    try {
        setup = await setupBrowser(log);
        browser = setup.browser;
        const page = await browser.newPage();
        await applyResourceBlocker(page);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&gl=us&hl=en`, { waitUntil: 'networkidle2', timeout: 60000 });

        // Handle consent
        try {
            const consentSelectors = [
                'button[aria-label="Accept all"]',
                'button[aria-label="Agree to the use of cookies and other data for the purposes described"]',
                'form[action*="consent"] button',
                'div[role="dialog"] button:last-of-type'
            ];
            for (const selector of consentSelectors) {
                if (await page.$(selector)) {
                    await page.click(selector);
                    await page.waitForNavigation({ timeout: 5000 }).catch(() => { });
                    break;
                }
            }
        } catch (e) { }

        // Extract search links and titles
        const results = await page.evaluate(() => {
            const badDomains = ['yelp', 'tripadvisor', 'facebook', 'instagram', 'linkedin', 'yellowpages', 'thumbtack', 'ubereats', 'deliveroo', 'just-eat', 'checkatrade', 'trustpilot', 'indeed', 'glassdoor', 'totaljobs', 'reed.co.uk', 'simplyhired'];
            return Array.from(document.querySelectorAll('div.g a'))
                .map(a => {
                    const titleEl = a.querySelector('h3');
                    return { href: a.href, title: titleEl ? titleEl.innerText : '' };
                })
                .filter(r => {
                    if (!r.href || !r.href.startsWith('http')) return false;
                    if (r.href.includes('google.com')) return false;
                    return !badDomains.some(d => r.href.toLowerCase().includes(d));
                });
        });

        log(`Found ${results.length} potential employer websites.`);
        const leads = [];

        for (const item of results) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            // Extract company name from title
            let company = item.title.split(/ - | \| |: /)[0]?.trim() || '';
            if (company.toLowerCase().includes('careers') || company.toLowerCase().includes('jobs') || company.toLowerCase().includes('vacancies')) {
                company = company.replace(/careers|jobs|vacancies/gi, '').replace(/\s+/g, ' ').trim();
            }
            if (!company) continue;

            log(`Processing employer website: ${company} (${item.href})`);

            let webData = { email: '', phone: '', summary: '' };
            try {
                webData = await scrapeWebsite(browser, item.href, log, '', false, company);
            } catch (e) {
                log(`Error scraping employer website ${item.href}: ${e.message}`);
            }

            const lead = {
                id: `employer-${Math.random().toString(36).substr(2, 9)}`,
                status: 'New',
                source: 'Employer Website',
                company: company,
                website: item.href,
                email: webData.email || '',
                phone: webData.phone || '',
                location: location || '',
                summary: `## ⚡ Quick Summary\nEmployer career page discovered via search.\n\n## 🔬 Deep Research\n- Company: ${company}\n- Careers Page: ${item.href}\n- Phone: ${webData.phone || 'N/A'}`
            };

            leads.push(lead);
            if (onResult) {
                onResult(lead).catch(err => log(`Error in onResult callback (Employer): ${err.message}`));
            }
        }

        return leads;
    } catch (error) {
        log(`Employer Website Scraping Error: ${error.message}`);
        throw error;
    } finally {
        await safeBrowserClose(browser);
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}



