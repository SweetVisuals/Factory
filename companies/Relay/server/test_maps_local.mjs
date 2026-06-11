import puppeteer from 'puppeteer';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeMaps(query, maxLimit) {
    console.log(`Starting headless Chrome for: ${query}`);
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-notifications',
            '--window-size=1280,800'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Make it look more like a real user
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Go to google maps
    console.log("Navigating to Google Maps...");
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log("Waiting for results pane...");
    // Consent if exists
    try {
        const consentBtn = await page.$('form[action*="consent"] button');
        if (consentBtn) {
            console.log("Accepting consent...");
            await consentBtn.click();
            await delay(2000);
        }
    } catch(e) {}
    
    try {
        // Wait for the main feed to appear
        await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
        
        console.log("Scrolling feed...");
        let previousHeight = 0;
        let sameHeightCount = 0;
        
        while (true) {
            const feedHandle = await page.$('div[role="feed"]');
            
            // Get current count
            const currentCount = await page.evaluate((feed) => {
                // Class names change, but roles don't. We look for articles or direct children with specific roles or just links that contain 'hfpxzc'
                return document.querySelectorAll('a.hfpxzc').length;
            }, feedHandle);
            
            console.log(`Current items: ${currentCount}`);
            if (currentCount >= maxLimit) break;
            
            // Scroll down
            const newHeight = await page.evaluate((feed) => {
                feed.scrollTop = feed.scrollHeight;
                return feed.scrollHeight;
            }, feedHandle);
            
            if (newHeight === previousHeight) {
                sameHeightCount++;
                if (sameHeightCount >= 5) { // 5 checks = end of list
                    console.log("Reached end of list.");
                    break;
                }
            } else {
                sameHeightCount = 0;
            }
            previousHeight = newHeight;
            await delay(1500); // Wait for load
        }
        
        console.log("Extracting data...");
        // Extract links to each business (we might have to click them to get details, or we can just grab from the list)
        // Note: Grabbing from the list might not have website/phone, we often have to click each one, OR the list might have some info.
        // Actually, clicking them is safer but slower. Let's see what's in the list.
        const places = await page.evaluate(() => {
            const results = [];
            const links = Array.from(document.querySelectorAll('a.hfpxzc'));
            for (const a of links) {
                const parent = a.parentElement;
                // Get title
                const title = a.getAttribute('aria-label') || '';
                
                // Get rating
                // Phone and website are not always in the feed view, typically you have to click them.
                results.push({
                    title,
                    url: a.href
                });
            }
            return results;
        });
        
        console.log(`Extracted ${places.length} places. First 3:`);
        console.log(places.slice(0, 3));
        
        // Let's click the first one to see how to extract phone and website
        if (places.length > 0) {
            console.log(`Clicking ${places[0].title} for details...`);
            await page.goto(places[0].url, { waitUntil: 'networkidle2' });
            await delay(2000);
            const details = await page.evaluate(() => {
                const addressBtn = document.querySelector('button[data-item-id="address"]');
                const websiteBtn = document.querySelector('a[data-item-id="authority"]');
                const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
                
                return {
                    address: addressBtn ? addressBtn.innerText : '',
                    website: websiteBtn ? websiteBtn.href : '',
                    phone: phoneBtn ? phoneBtn.innerText : ''
                };
            });
            console.log("Details found:", details);
        }
        
    } catch(e) {
        console.error("Scraping failed:", e.message);
    }
    
    await browser.close();
}

scrapeMaps('plumbers in London', 10).catch(console.error);
