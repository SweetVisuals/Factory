import puppeteer from 'puppeteer';

async function run() {
    console.log('Launching browser WITHOUT image blocking...');
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log('Navigating to Google Maps...');
        await page.goto('https://www.google.com/maps?hl=en&gl=us', { waitUntil: 'networkidle2', timeout: 60000 });

        // Helper to handle consent
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
                    console.log('Consent handled.');
                    break;
                }
            }
        } catch (e) {}

        console.log('Searching for "Roofing in Austin"...');
        const searchInputSelector = 'input[name="q"]';
        await page.waitForSelector(searchInputSelector, { timeout: 10000 });
        
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) el.value = '';
        }, searchInputSelector);

        await page.type(searchInputSelector, 'Roofing in Austin');
        await page.keyboard.press('Enter');

        console.log('Waiting 10 seconds...');
        await new Promise(r => setTimeout(r, 10000));

        // Save screenshot
        console.log('Saving screenshot to map_debug_no_blocker.png...');
        await page.screenshot({ path: 'map_debug_no_blocker.png' });

        // Log DOM counts
        const stats = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                articles: document.querySelectorAll('div[role="article"]').length,
                links: document.querySelectorAll('a[href*="/maps/place/"]').length,
                feed: !!document.querySelector('div[role="feed"]'),
                bodyTextLength: document.body.innerText.length
            };
        });

        console.log('--- PAGE STATS ---');
        console.log(JSON.stringify(stats, null, 2));

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
}

run();
