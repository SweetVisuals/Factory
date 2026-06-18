import puppeteer from 'puppeteer';

async function testMaps() {
    console.log("Launching...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    console.log("Going to Google Maps...");
    await page.goto('https://www.google.com/maps/search/restaurants+in+new+york', { waitUntil: 'networkidle2' });
    
    // Wait for the results pane
    console.log("Waiting for results...");
    try {
        await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
        const items = await page.evaluate(() => {
            const results = [];
            const elements = document.querySelectorAll('div[role="feed"] > div');
            for (const el of elements) {
                const titleEl = el.querySelector('.fontHeadlineSmall');
                if (titleEl) {
                    results.push(titleEl.innerText);
                }
            }
            return results;
        });
        console.log("Found:", items);
    } catch (e) {
        console.error("Failed to find feed:", e.message);
        // dump page content
        const html = await page.content();
        console.log(html.substring(0, 500));
    }
    await browser.close();
}

testMaps().catch(console.error);
