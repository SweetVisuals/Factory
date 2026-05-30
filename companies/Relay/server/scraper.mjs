import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { validateEmail } from './email-validation.mjs';
import { fetchAIChatCompletion } from './ai-client.mjs';

const execPromise = util.promisify(exec);

const createLogger = (onLog) => (message) => {
    try {
        fs.appendFileSync('scraper_debug.log', `[${new Date().toISOString()}] ${message}\n`);
    } catch (e) {
        console.error('Error writing to scraper_debug.log:', e);
    }
    console.log(message);
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
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const url = request.url().toLowerCase();
            
            // Block images, media, fonts, and tracking scripts
            if (['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'].includes(resourceType) ||
                url.includes('google-analytics') || 
                url.includes('analytics') || 
                url.includes('facebook.com') || 
                url.includes('doubleclick') || 
                url.includes('pixel') || 
                url.includes('hotjar') || 
                url.includes('adsystem')) {
                request.abort();
            } else {
                request.continue();
            }
        });
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
async function setupBrowser(log, options = {}) {
    let browser;
    let puppeteer;
    let profileDir = null;

    // Clean up old profiles before launching a new one
    cleanupTmpProfiles();

    const isMaps = options.isMaps || false;
    const chromeArgs = [...LIGHTWEIGHT_CHROME_ARGS];
    if (isMaps) {
        // Remove image disabling for Google Maps as it breaks the layout rendering
        const idx = chromeArgs.indexOf('--blink-settings=imagesEnabled=false');
        if (idx > -1) {
            chromeArgs.splice(idx, 1);
        }
    }

    try {
        const p = await import('puppeteer');
        puppeteer = p.default || p;
    } catch (e) {
        if (log) log('Failed to load puppeteer. Ensure it is installed.');
        throw new Error('Puppeteer dependency missing');
    }

    if (process.env.BROWSER_WS_ENDPOINT) {
        if (log) log(`Connecting to remote browser: ${process.env.BROWSER_WS_ENDPOINT}`);
        browser = await puppeteer.connect({
            browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT,
        });
        return { browser, puppeteer };
    }

    const isWindows = process.platform === 'win32';

    if (isWindows) {
        if (log) log('Running locally on Windows. Launching lightweight Chrome...');
        const uniqueId = `profile_std_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        profileDir = `./tmp/${uniqueId}`;
        
        // Ensure tmp dir exists
        if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });

        try {
            browser = await puppeteer.launch({
                headless: "new",
                userDataDir: profileDir,
                args: chromeArgs
            });
        } catch (e) {
            if (log) log(`Standard launch failed: ${e.message}. Attempting to find local Chrome...`);
            
            const commonPaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
            ];

            for (const p of commonPaths) {
                try {
                    if (fs.existsSync(p)) {
                        if (log) log(`Found Chrome at: ${p}. Launching lightweight...`);
                        browser = await puppeteer.launch({
                            executablePath: p,
                            headless: "new",
                            userDataDir: profileDir,
                            args: chromeArgs
                        });
                        break;
                    }
                } catch (err) {}
            }
        }

        if (!browser) {
            if (log) log('CRITICAL: Could not find or launch Chrome on Windows.');
            throw new Error('Chrome launch failed');
        }

        return { browser, puppeteer, profileDir };
    } else {
        if (log) log('Running on Linux (Server environment). Attempting to use @sparticuz/chromium or standard puppeteer.');
        const os = await import('os');
        const path = await import('path');

        // Use a fixed path relative to the app directory instead of recursively modifying HOME
        const localTmp = path.resolve(process.cwd(), './tmp/.local_chrome');
        if (!fs.existsSync(localTmp)) { fs.mkdirSync(localTmp, { recursive: true }); }

        process.env.TMPDIR = localTmp;
        // Only set HOME for puppeteer's child processes, don't override the Node process HOME
        const envWithHome = { ...process.env, HOME: localTmp };

        try {
            const sparticuzModule = await import('@sparticuz/chromium');
            const sparticuz = sparticuzModule.default || sparticuzModule;
            const pCore = await import('puppeteer-core');
            const puppeteerCore = pCore.default || pCore;

            const executablePath = await sparticuz.executablePath();
            const args = [...sparticuz.args, ...chromeArgs];

            browser = await puppeteerCore.launch({
                args: args,
                executablePath: executablePath,
                headless: "new",
                ignoreHTTPSErrors: true,
                env: envWithHome
            });
            if (log) log('Successfully launched using @sparticuz/chromium.');
            return { browser, puppeteer: puppeteerCore, profileDir: null };
        } catch (e) {
            if (log) log(`Sparticuz failed/missing: ${e.message}. Falling back to standard puppeteer.`);
            const uniqueId = `profile_linux_${Date.now()}`;
            profileDir = `./tmp/${uniqueId}`;
            if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });

            const launchConfig = {
                headless: "new",
                args: chromeArgs,
                userDataDir: profileDir,
                env: envWithHome
            };
            
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            } else {
                // Let Puppeteer use its bundled Chromium instead of hardcoding /usr/bin/ paths
                // that might be broken symlinks or missing dependencies.
                if (log) log('Using Puppeteer bundled browser.');
            }
            
            browser = await puppeteer.launch(launchConfig);

            return { browser, puppeteer, profileDir };
        }
    }
}

export async function scrapeGoogleMaps(query, limit = 50, onLog = null, onResult = null, notesContext = '', deepResearch = false, checkState = null) {
    const log = createLogger(onLog);
    // Respect the user's limit
    const targetLimit = limit;
    log(`Starting Google Maps scraper for: ${query} (Target: ${targetLimit})`);

    let browser;
    let puppeteer;
    try {
        log('Launching browser...');
        const setup = await setupBrowser(log, { isMaps: true });
        browser = setup.browser;
        puppeteer = setup.puppeteer;
        log('Browser launched successfully.');
    } catch (e) {
        log(`CRITICAL: Browser Launch Failed: ${e.message}`);
        return [];
    }

    const page = await browser.newPage();

    // Smaller viewport to reduce rendering cost
    await page.setViewport({ width: 1280, height: 720 });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let leads = [];
    try {
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
        log(`Navigating directly to search URL: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // helper to handle consent
        const handleConsent = async () => {
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
                        return;
                    }
                }
            } catch (e) { }
        };

        await handleConsent();

        log('Waiting for search results container to render...');
        try {
            await page.waitForSelector('div[role="feed"], div[role="article"], a[href*="/maps/place/"], .Nv2PK, h1.DUwDvf', { timeout: 15000 });
        } catch (e) {
            log(`Wait for search results timed out/failed: ${e.message}`);
        }

        const processedIds = new Set();
        let noNewResultsCount = 0;
        let totalProcessed = 0;
        const feedSelector = 'div[role="feed"]';

        // More persistent loop to handle up to 5000
        while (leads.length < targetLimit && noNewResultsCount < 30) {
            if (checkState) await checkState();
            const elements = await page.$$('div[role="article"], a[href*="/maps/place/"], .Nv2PK, div[data-result-index]');

            if (elements.length === 0) {
                const isSingleResult = await page.evaluate(() => {
                    const titleEl = document.querySelector('h1.DUwDvf');
                    const feedEl = document.querySelector('div[role="feed"]');
                    return !!titleEl && !feedEl;
                });
                
                if (isSingleResult) {
                    log('Detected single result page. Extracting business directly...');
                    const leadDetails = await page.evaluate(() => {
                        const nameEl = document.querySelector('h1.DUwDvf');
                        if (!nameEl) return null;
                        const name = nameEl.innerText.trim();
                        
                        let website = '';
                        const webEl = document.querySelector('a[data-item-id="authority"]');
                        if (webEl) website = webEl.href || '';
                        
                        let phone = '';
                        const phoneEl = document.querySelector('button[data-item-id*="phone:tel:"]');
                        if (phoneEl) {
                            phone = phoneEl.getAttribute('data-item-id').replace('phone:tel:', '').trim();
                        } else {
                            const phoneBtn = document.querySelector('button[aria-label*="Phone:"]');
                            if (phoneBtn) phone = phoneBtn.getAttribute('aria-label').replace(/Phone:\s*/i, '').trim();
                        }
                        
                        const addressEl = document.querySelector('button[data-item-id="address"]');
                        const address = addressEl ? addressEl.innerText.trim() : '';
                        
                        return { name, website, phone, address };
                    });
                    
                    if (leadDetails && leadDetails.name) {
                        const getCleanUrl = (url) => {
                            if (!url) return '';
                            if (url.includes('google.com/viewer')) return '';
                            if (url.includes('google.com/aclk') || url.includes('google.com/url')) {
                                try { return decodeURIComponent(url.split('adurl=')[1] || url.split('q=')[1]).split('&')[0]; } catch (e) { return url; }
                            }
                            return url;
                        };
                        const cleanWeb = getCleanUrl(leadDetails.website);
                        const result = {
                            id: `scraped-${Math.random().toString(36).substr(2, 9)}`,
                            name: '',
                            company: leadDetails.name,
                            phone: leadDetails.phone,
                            website: cleanWeb,
                            address: leadDetails.address,
                            source: 'google_maps',
                            query,
                            status: 'New'
                        };
                        
                        if (cleanWeb) {
                            log(`Deep scraping single website: ${cleanWeb}`);
                            try {
                                const webDetails = await scrapeWebsite(browser, cleanWeb, log, notesContext, deepResearch);
                                result.email = webDetails.email || '';
                                result.summary = webDetails.summary || '';
                                if (webDetails.phone && !result.phone) result.phone = webDetails.phone;
                                if (webDetails.social && webDetails.social.linkedin && !result.linkedin) result.linkedin = webDetails.social.linkedin;
                                if (webDetails.social && webDetails.social.facebook && !result.facebook) result.facebook = webDetails.social.facebook;
                                if (webDetails.social && webDetails.social.twitter && !result.twitter) result.twitter = webDetails.social.twitter;
                                if (webDetails.social && webDetails.social.instagram && !result.instagram) result.instagram = webDetails.social.instagram;
                                
                                // DDG X-RAY FOR CEO/FOUNDER
                                try {
                                    const xray = await scrapeDDGXRay(browser, leadDetails.name);
                                    if (xray && xray.name) {
                                        result.name = xray.name;
                                        result.title = 'Executive';
                                        if (xray.link && !result.linkedin) result.linkedin = xray.link;
                                    }
                                } catch (e) {}

                            } catch (e) {
                                log(`Single website deep scrape failed: ${e.message}`);
                            }
                        }
                        
                        leads.push(result);
                        if (onResult && typeof onResult === 'function') {
                            onResult(result).catch(err => log(`Error in onResult callback: ${err.message}`));
                        }
                    }
                } else {
                    log('No Google Maps search results detected on page. Stopping maps scrape early to prevent empty looping.');
                }
                break;
            }

            // Process Items
            const batchPromises = [];
            for (const el of elements) {
                if (checkState) await checkState();
                if (leads.length >= targetLimit) break;

                const ariaLabel = await el.evaluate(e => e.getAttribute('aria-label'));
                if (processedIds.has(ariaLabel)) continue;

                // AD FILTER: Skip Sponsored results
                const isAds = await el.evaluate(e => {
                    return e.innerText.includes('Sponsored') || e.innerText.includes('Ad ·');
                });
                if (isAds) {
                    log(`Skipped ${ariaLabel}: Sponsored Result.`);
                    continue;
                }

                // RELEVANCE FILTER: Check if name matches query context
                const lowerName = (ariaLabel || '').toLowerCase();
                const lowerQuery = query.toLowerCase();

                // Simple negative keywords based on common mixups or map ads
                if (lowerQuery.includes('food') || lowerQuery.includes('market') || lowerQuery.includes('truck')) {
                    if (lowerName.includes('car wash') ||
                        lowerName.includes('mechanic') ||
                        lowerName.includes('repair') ||
                        lowerName.includes('accountant') ||
                        lowerName.includes('solicitor') ||
                        lowerName.includes('dental') ||
                        lowerName.includes('clinic')) {
                        log(`Skipped ${ariaLabel}: Irrelevant to query.`);
                        continue;
                    }
                }



                processedIds.add(ariaLabel);
                totalProcessed++;

                batchPromises.push((async () => {
                    try {
                        // Helper for robust phone extraction (UK focus)
                        const extractPhoneNumber = (str) => {
                            if (!str) return '';

                            // Specific US Patterns: (555) 555-5555, 555-555-5555, +1 555...
                            const usMatch = str.match(/(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
                            if (usMatch) return usMatch[0].replace(/\s+/g, ' ').trim();

                            // Specific UK Patterns (Secondary):
                            const ukMatch = str.match(/(?:(?:\+|00)44|(?<!\d)44|(?<!\d)0)(?:2|7)[\d\s-]{8,13}/);
                            if (ukMatch) return ukMatch[0].replace(/\s+/g, ' ').trim();

                            // Fallback: Standard International
                            const intlMatch = str.match(/(\+|00)[0-9][0-9\s-]{8,20}[0-9]/);
                            if (intlMatch) return intlMatch[0].replace(/\s+/g, ' ').trim();

                            return '';
                        };

                        const text = await el.evaluate(e => e.innerText);
                        let phone = extractPhoneNumber(text);

                        const getCleanUrl = (url) => {
                            if (!url) return '';
                            // Bad Google Viewer links
                            if (url.includes('google.com/viewer')) return '';

                            if (url.includes('google.com/aclk') || url.includes('google.com/url')) {
                                try { return decodeURIComponent(url.split('adurl=')[1] || url.split('q=')[1]).split('&')[0]; } catch (e) { return url; }
                            }
                            return url;
                        };

                        let websiteUrl = await el.evaluate(e => {
                            const anchors = Array.from(e.querySelectorAll('a'));
                            // Try multiple strategies to find the website link
                            const webLink = anchors.find(a => {
                                const href = a.href || '';
                                const label = (a.getAttribute('aria-label') || '').toLowerCase();
                                const dataVal = a.getAttribute('data-value');

                                // Skip map links/directions
                                if (href.includes('google.com/maps')) return false;

                                // Explicit Website Buttons
                                if (dataVal === 'Website' || label.includes('website')) return true;

                                // Generic non-google links (often the title link is just a map deep link, so ignore long google urls)
                                if (href.startsWith('http') && !href.includes('google.com')) return true;

                                return false;
                            });
                            return webLink ? webLink.href : '';
                        });

                        let website = getCleanUrl(websiteUrl);

                        // DEEP SCRAPE: Click if info missing
                        if (!phone && !website) {
                            try {
                                await el.click();
                                await new Promise(r => setTimeout(r, 1500));

                                const sideData = await page.evaluate(() => {
                                    const res = { phone: '', website: '', lastReviewDate: '', rating: '', reviewCount: '' };
                                    const main = document.querySelector('div[role="main"]');
                                    if (!main) return res;

                                    // Extract Rating and Review Count
                                    const ratingEl = main.querySelector('span[aria-label*="stars"]');
                                    if (ratingEl) {
                                        res.rating = ratingEl.getAttribute('aria-label');
                                        const countEl = ratingEl.parentElement.querySelector('span[aria-label*="reviews"]');
                                        if (countEl) res.reviewCount = countEl.getAttribute('aria-label');
                                    }

                                    // Extract Last Review Date (roughly)
                                    // Usually found in the "Reviews" summary or latest review snippet if visible
                                    const reviewSnippets = Array.from(main.querySelectorAll('div[data-review-id]'));
                                    if (reviewSnippets.length > 0) {
                                        // Try to find the date span in the first snippet
                                        const dateEl = reviewSnippets[0].querySelector('span[class*="publish-date"]');
                                        if (dateEl) res.lastReviewDate = dateEl.innerText;
                                    } else {
                                        // Fallback: search for relative time strings in the side panel
                                        const text = main.innerText;
                                        const timeMatch = text.match(/\d+\s+(day|week|month|year)s?\s+ago/i);
                                        if (timeMatch) res.lastReviewDate = timeMatch[0];
                                    }

                                    // Scan everything
                                    const candidates = Array.from(main.querySelectorAll('a, button, div[data-item-id]'));

                                    for (const c of candidates) {
                                        const label = (c.getAttribute('aria-label') || '').toLowerCase();
                                        const itemId = c.getAttribute('data-item-id') || '';
                                        const href = c.href || '';
                                        const txt = c.innerText || '';

                                        // Website
                                        if (!res.website) {
                                            const isWeb = itemId.includes('authority') || label.includes('website') || (href && !href.includes('google') && !href.includes('fid='));
                                            if (isWeb && href) res.website = href;
                                        }

                                        // Phone
                                        if (!res.phone) {
                                            const isPhone = itemId.includes('phone') || label.includes('phone') || label.includes('call') || itemId.includes('call');
                                            if (isPhone) {
                                                // Prioritize US Patterns: (555) 555-5555
                                                const usRegex = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
                                                const ukRegex = /(?:(?:\+|00)44|(?:\b)44|(?:\b)0)(?:2|7)[\d\s-]{8,13}/;
                                                
                                                const searchStr = (label + ' ' + txt);
                                                const mUS = searchStr.match(usRegex);
                                                const mUK = searchStr.match(ukRegex);
                                                
                                                if (mUS) res.phone = mUS[0].replace(/\s+/g, ' ').trim();
                                                else if (mUK) res.phone = mUK[0].replace(/\s+/g, ' ').trim();
                                            }
                                        }
                                    }
                                    return res;
                                });

                                if (sideData.phone && !phone) phone = sideData.phone;
                                if (sideData.website && !website) website = getCleanUrl(sideData.website);
                                
                                // Activity Check: Filter out if last review was > 2 years ago
                                if (sideData.lastReviewDate) {
                                    const lrd = sideData.lastReviewDate.toLowerCase();
                                    if (lrd.includes('year') && !lrd.includes('1 year')) {
                                        const years = parseInt(lrd.match(/\d+/)?.[0] || '0');
                                        if (years >= 2) {
                                            log(`Dropped ${ariaLabel}: Inactive business (Last review: ${sideData.lastReviewDate})`);
                                            return null;
                                        }
                                    }
                                }
                            } catch (e) { }
                        }

                        if (website && !website.startsWith('http') && !website.includes('google')) website = 'http://' + website;

                        // FALLBACK: If no website found on Maps, Search Google for it!
                        if (!website || website === 'http://' || website.length < 8 || website.includes('google')) {
                            // Reset if invalid
                            if (website.length < 8) website = '';

                            try {
                                log(`Maps didn't have website for ${ariaLabel}, searching Google...`);
                                const searchQuery = `${ariaLabel} ${query.replace(' in ', ' ')} official site`;
                                const foundUrl = await findWebsiteViaGoogle(browser, searchQuery);
                                if (foundUrl) {
                                    website = foundUrl;
                                    log(`Found Website via Search: ${website}`);
                                } else {
                                    log(`Search returned no website for ${ariaLabel}`);
                                }
                            } catch (e) {
                                log(`Fallback Search Error: ${e.message}`);
                            }
                        }

                        // DATA CONTAINERS
                        let email = '';
                        let summary = '';
                        const social = { twitter: '', facebook: '', instagram: '', linkedin: '', tiktok: '' };

                        // DIRECTORY FILTER
                        const DIRECTORY_DOMAINS = ['birdeye.com', 'yell.com', 'yellowpages.com', 'yelp.com', 'facebook.com', 'instagram.com', 'checkatrade.com', 'tripadvisor.com', 'trustpilot.com', 'kompass.com', 'cylex-uk.co.uk', 'cylex.us.com', 'bbb.org', 'clutch.co', 'expertise.com'];

                        let isDirectory = false;
                        if (website) isDirectory = DIRECTORY_DOMAINS.some(d => website.includes(d));

                        // VISIT WEBSITE
                        if (website && !website.includes('google') && !isDirectory) {
                            try {
                                const webData = await scrapeWebsite(browser, website, log, notesContext, deepResearch, ariaLabel);
                                if (webData.email) email = webData.email;
                                if (webData.phone && !phone) phone = webData.phone;
                                if (webData.summary) summary = webData.summary;
                                Object.assign(social, webData.social);
                            } catch (e) { }
                        }

                        // FALLBACK SEARCH
                        if (!email) {
                            try {
                                const googleEmail = await googleSearchEmail(browser, ariaLabel, website);
                                if (googleEmail) email = googleEmail;
                            } catch (e) { }
                        }

                        // DDG X-RAY FOR CEO/FOUNDER
                        let ceoName = '';
                        let ceoTitle = '';
                        if (ariaLabel) {
                            try {
                                const xray = await scrapeDDGXRay(browser, ariaLabel);
                                if (xray && xray.name) {
                                    ceoName = xray.name;
                                    ceoTitle = 'Executive';
                                    if (xray.link && !social.linkedin) social.linkedin = xray.link;
                                }
                            } catch (e) {}
                        }

                        // Directory Email Filter (e.g. profiles@birdeye.com)
                        if (email) {
                            const emailParts = email.split('@');
                            if (emailParts.length === 2) {
                                const d = emailParts[1].toLowerCase();
                                if (DIRECTORY_DOMAINS.some(dd => d.includes(dd))) {
                                    log(`Dropped ${ariaLabel}: Email domain (${d}) is a directory/aggregator.`);
                                    email = '';
                                }
                            }
                        }

                        // ACCURACY FILTER: We keep leads even without direct contact info if they have a website!
                        if (!email && !phone && !website) {
                            log(`Dropped ${ariaLabel}: No contact info or website found.`);
                            return null;
                        }

                        if (!email) {
                            log(`Keeping fallback lead: ${ariaLabel} (Website: ${website}, Phone: ${phone || 'N/A'})`);
                        }

                        if (!ariaLabel) {
                            log(`Dropped lead: Missing company name.`);
                            return null;
                        }

                        log(`Found: ${ariaLabel} (Email: ${email || 'No'} | Phone: ${phone || 'No'} | Exec: ${ceoName || 'No'} | Summary: ${summary ? 'Yes' : 'No'})`);

                        return {
                            id: `scraped-${Math.random().toString(36).substr(2, 9)}`,
                            name: ceoName,
                            title: ceoTitle,
                            status: 'New',
                            company: ariaLabel,
                            email, phone, website, summary,
                            role: '',
                            twitter: social.twitter, facebook: social.facebook, instagram: social.instagram, linkedin: social.linkedin, tiktok: social.tiktok,
                            location: query.split(' in ')[1] || 'Unknown',
                            source: 'Google Maps'
                        };
                    } catch (e) { return null; }
                })());
            }

            // Process Items with limited concurrency (Max 3 at a time) to prevent CPU spikes
            const results = [];
            const CONCURRENCY_LIMIT = 3;
            
            for (let i = 0; i < batchPromises.length; i += CONCURRENCY_LIMIT) {
                const chunk = batchPromises.slice(i, i + CONCURRENCY_LIMIT);
                const chunkResults = await Promise.all(chunk);
                results.push(...chunkResults.filter(x => x));
                
                // Optional: Short delay between chunks to let CPU breathe
                if (i + CONCURRENCY_LIMIT < batchPromises.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            
            leads.push(...results);

            // Emit Live Results
            if (onResult && typeof onResult === 'function') {
                for (const result of results) {
                    onResult(result).catch(err => log(`Error in onResult callback: ${err.message}`));
                }
            }

            log(`Progress: ${leads.length} leads. (Scanned ${totalProcessed})`);

            // SCROLL & DISCOVERY
            if (leads.length < targetLimit) {
                log('Scrolling for more results...');
                await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.scrollBy(0, 4000);
                    } else {
                        window.scrollBy(0, 1500);
                    }
                }, feedSelector);

                // Use mouse wheel for additional scroll depth
                await page.mouse.move(700, 500);
                await page.mouse.wheel({ deltaY: 3000 });

                await new Promise(r => setTimeout(r, 3000));

                const newEls = await page.$$('div[role="article"], a[href*="/maps/place/"], .Nv2PK, div[data-result-index]');
                if (newEls.length <= elements.length) {
                    noNewResultsCount++;
                    log(`No new results by scrolling (${noNewResultsCount}/30). Trying "Search this area" / Browsing mode...`);
                    
                    // Attempt to click "Search this area" button if it appears
                    const searchAreaBtn = await page.$('button[jsaction*="searchthisarea"], button[aria-label*="Search this area"]');
                    if (searchAreaBtn) {
                        log('Found "Search this area" button. Clicking to refresh viewport...');
                        await searchAreaBtn.click();
                        await new Promise(r => setTimeout(r, 4000));
                        noNewResultsCount = 0; // Reset as we've refreshed the search
                    } else {
                        // Move map slightly and zoom out to trigger new results
                        log('Browsing: Moving map and zooming out to discover more businesses...');
                        await page.keyboard.press('Minus'); // Zoom out
                        await page.mouse.move(400, 400);
                        await page.mouse.down();
                        await page.mouse.move(500, 500);
                        await page.mouse.up();
                        await new Promise(r => setTimeout(r, 3000));
                    }
                } else {
                    log(`Found ${newEls.length - elements.length} new potential leads.`);
                    noNewResultsCount = 0;
                }
            }
        }
        log(`Scraping Complete. Found ${leads.length} leads.`);
        return leads;
    } catch (e) {
        log(`Error in Google Maps Scraper: ${e.message}`);
        return leads;
    } finally {
        if (browser) {
            try {
                log('Closing browser...');
                await browser.close();
                log('Browser closed.');
            } catch (e) {
                log(`Error closing browser: ${e.message}`);
            }
        }
        // Explicitly cleanup this specific profile if on Windows
        if (typeof setup !== 'undefined' && setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try {
                fs.rmSync(setup.profileDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
}

// LinkedIn Scraper using Google Search
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
        if (browser) await browser.close();
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
        if (browser) await browser.close();
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

// Helper: Fetch with retry (no rate limiting needed for DeepSeek)
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
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        throw new Error('Max retries exceeded for API call');
    })();
}

// Helper: Generate AI Summary with strict Deep Research format
async function generateAISummary(text, notesContext = '', isDeepResearch = true) {
    const log = console.log;
    try {
        if (!text || text.length < 5) {
            log('GENERATE_AI_SUMMARY: Text too short, returning generic fallback.');
            return "## ⚡ Quick Summary\nUnable to generate summary due to insufficient data.\n\n## 🔬 Deep Research\nNo deep research available.";
        }

        log(`GENERATE_AI_SUMMARY: Generating summary for text length: ${text.length}, deepResearch: ${isDeepResearch}`);

        // DEEP RESEARCH PROMPT
        let contextInstruction = '';
        if (notesContext && notesContext.trim().length > 0) {
            contextInstruction = `CRITICAL INSTRUCTION: The user specifically wants to know: "${notesContext}". YOU MUST ADDRESS THIS in a dedicated section titled "## 🎯 Response to Query" at the very beginning of your report. If the info is found, state it clearly. If not, state "Information not found".\n\n`;
        }

        let systemPrompt = '';

        if (isDeepResearch) {
            systemPrompt = `You are an elite business intelligence researcher. 
Your task is to write a detailed "Deep Research" report (approx 400-600 words) about the target company.

${contextInstruction}Structure your response exactly as follows:

## ⚡ Quick Summary
(Write 2-3 concise sentences summarizing the company and its key value proposition. This is for quick scanning.)

## 🔬 Deep Research
(The detailed report starts here.)

Focus Areas for Deep Research:
1. **Executive Summary**: What they do, their niche, their "vibe".
2. **Key People**: Identify CEO, Founders, or key roles if present in the data. *Crucial*: Try to find specific names.
3. **Social Presence**: Analyze their social media footprint.
4. **Specific Observations**: Quirky details, specific "things they like".
5. **Business Data**: Briefly mention how we found them (Website, Search).

Tone: Professional, insightful, "Sherlock Holmes" style.
Format: Markdown (headers ##, bullet points).
`;
        } else {
            systemPrompt = `You are an AI assistant helping a user extract specific information from a company's website.

${contextInstruction}Structure your response exactly as follows:
(Do not include a massive executive summary or deep research report, as the user specifically disabled Deep Research for this query).

## ⚡ Quick Summary
(Write 1-2 concise sentences summarizing what the company does based on the text).

Format: Markdown. Keep it direct and concise.`;
        }

        const data = await fetchAIChatCompletion({
            model: 'deepseek-v4-flash',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Here is the gathered data:\n\n${text.substring(0, 15000)}` }
            ],
            temperature: 0.3
        }, log);
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            const content = data.choices[0].message.content.trim();
            if (content.length < 10) throw new Error('AI returned empty/too short content');

            // Validate headers
            if (!content.includes('##')) {
                // If AI decided to skip headers, force add them
                return `## ⚡ Quick Summary\n${content.substring(0, 200)}...\n\n## 🔬 Deep Research\n${content}`;
            }
            return content;
        }
        throw new Error('No choices returned from API');

    } catch (e) {
        console.error('AI Summary Generation Fatal Error:', e);
        // Fallback that LOOKS like a summary so the UI doesn't show "No summary available"
        return `## ⚡ Quick Summary\nAutomated research encountered an error: ${e.message}\n\n## 🔬 Deep Research\nCould not complete deep research due to an error.`;
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
    const data = { email: '', phone: '', summary: '', social: { twitter: '', facebook: '', instagram: '', linkedin: '', tiktok: '' } };

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
                            return (t.includes('accept') || t.includes('agree') || t.includes('allow all') || t === 'ok')
                                && !t.includes('show') && !t.includes('manage');
                        });
                        if (acceptBtn) {
                            acceptBtn.click();
                            return true;
                        }
                        return false;
                    });

                    if (accepted) {
                        await new Promise(r => setTimeout(r, 1000));
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

                return { emails: validEmails, phone, social, text: rawText };
            };

            // --- SCAN HOME PAGE ---
            const homeData = await extractContacts(page);
            homeData.emails.forEach(e => allFoundEmails.add(e));
            if (homeData.phone) data.phone = homeData.phone;
            Object.assign(data.social, homeData.social);
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
                data.summary = await generateAISummary(aggregatedText, notesContext, deepResearch);
            } else {
                log('Data too sparse for normal research. Attempting minimal AI research.');
                data.summary = await generateAISummary(`Company Name: ${companyName}\nSource: Minimal data found.`, notesContext, deepResearch);
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

// Deep Research Function
export async function performDeepResearch(company, website, notesContext = '') {
    const log = console.log;
    log(`Starting Deep Research for ${company} (${website})...`);

    let puppeteerMod;
    try {
        const p = await import('puppeteer');
        puppeteerMod = p.default || p;
    } catch (e) {
        throw new Error('Puppeteer dependency missing for deep research');
    }
    const browser = await puppeteerMod.launch({
        headless: "new",
        args: LIGHTWEIGHT_CHROME_ARGS
    });

    try {
        let aggregatedData = `Company: ${company}\nWebsite: ${website}\nUser Context: ${notesContext}\n\n`;

        // 1. Scrape Website Deeply (if exists)
        if (website && website.startsWith('http')) {
            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 20000 });

                // Get Home Page Text
                const homeText = await page.evaluate(() => {
                    const clone = document.body.cloneNode(true);
                    clone.querySelectorAll('script, style, noscript, iframe, svg').forEach(b => b.remove());
                    return clone.innerText.substring(0, 5000);
                });
                aggregatedData += `[WEBSITE_HOME]:\n${homeText}\n\n`;

                // Find About/Team pages
                const links = await page.$$eval('a', as => as.map(a => a.href));
                const aboutLink = links.find(l => l.toLowerCase().includes('about') || l.toLowerCase().includes('story'));
                const teamLink = links.find(l => l.toLowerCase().includes('team') || l.toLowerCase().includes('people'));

                if (aboutLink) {
                    try {
                        await page.goto(aboutLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        const aboutText = await page.evaluate(() => {
                            const clone = document.body.cloneNode(true);
                            clone.querySelectorAll('script, style, noscript, iframe, svg').forEach(b => b.remove());
                            return clone.innerText.substring(0, 3000);
                        });
                        aggregatedData += `[WEBSITE_ABOUT]:\n${aboutText}\n\n`;
                    } catch (e) { }
                }

                if (teamLink) {
                    try {
                        await page.goto(teamLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        const teamText = await page.evaluate(() => {
                            const clone = document.body.cloneNode(true);
                            clone.querySelectorAll('script, style, noscript, iframe, svg').forEach(b => b.remove());
                            return clone.innerText.substring(0, 3000);
                        });
                        aggregatedData += `[WEBSITE_TEAM]:\n${teamText}\n\n`;
                    } catch (e) { }
                }

                await page.close();
            } catch (e) {
                log(`Website scrape error: ${e.message}`);
                aggregatedData += `[WEBSITE_ERROR]: Could not access website fully.\n`;
            }
        }

        // 2. Search for CEO/Key People via Google
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Search Query: "Company Name CEO founder team linkedin"
            const query = `${company} CEO founder owner team linkedin`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const searchResults = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('div.g')).map(el => el.innerText).slice(0, 6).join('\n---\n');
            });

            aggregatedData += `[GOOGLE_SEARCH_PEOPLE]:\n${searchResults}\n\n`;

            // Search Query: "Company Name reviews social media"
            const querySocial = `${company} reviews social media facebook instagram twitter`;
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(querySocial)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const socialResults = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('div.g')).map(el => el.innerText).slice(0, 6).join('\n---\n');
            });
            aggregatedData += `[GOOGLE_SEARCH_SOCIAL]:\n${socialResults}\n\n`;

            await page.close();
        } catch (e) {
            log(`Google search error: ${e.message}`);
        }

        const systemPrompt = `You are an elite business intelligence researcher. 
        Your task is to write a comprehensive "Deep Research" report (approx 600 words) about the target company.
        
        Focus Areas:
        1. **Executive Summary**: What they do, their niche, their "vibe".
        2. **Key People**: Identify CEO, Founders, or key roles if present in the data. *Crucial*: Try to find specific names.
        3. **Social Presence**: Analyze their social media footprint (based on search results). What do they post? What do they like? Who is their audience?
        4. **Business Data**: Briefly mention how we found them (Website, Search).
        5. **Specific Observations**: Quirky details, specific "things they like" (e.g. they support a specific charity, they love coffee, they use specific tech).
        
        Tone: Professional but insightful. "Sherlock Holmes" style - deducing things from the data.
        Format: Markdown. Use headers (##), bullet points, and bold text.
        Length: Around 600 words. Be detailed.
        
        Input Data provided below (Website dumps + Google Search Snippets).`;

        const data = await fetchAIChatCompletion({
            model: 'deepseek-v4-flash',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: aggregatedData }
            ],
            temperature: 0.7
        }, log);
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content;
        } else {
            throw new Error('No response from AI');
        }

    } catch (e) {
        log(`Deep Research Error: ${e.message}`);
        return `Failed to perform deep research: ${e.message}`;
    } finally {
        await browser.close();
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
                        location: item.address || '',
                        summary: `## ⚡ Quick Summary\nOfficial UK registered company found on Companies House (Number: ${item.companyNumber || 'N/A'}). Status: Active.\n\n## 🔬 Deep Research\n- Registered Address: ${item.address}\n- Website: ${website}\n- Identified details: ${item.meta}`
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
        if (usedBrowser && browser) await browser.close();
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
        if (browser) await browser.close();
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

        for (const item of companies) {
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
        if (browser) await browser.close();
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
        if (browser) await browser.close();
        if (setup?.profileDir && fs.existsSync(setup.profileDir)) {
            try { fs.rmSync(setup.profileDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}



