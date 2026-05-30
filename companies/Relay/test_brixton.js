const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('https://www.google.com/maps', { waitUntil: 'networkidle2' });

    // Accept cookies if present
    try {
        const acceptButton = await page.$('button[aria-label="Accept all"]');
        if (acceptButton) {
            await acceptButton.click();
            await page.waitForNavigation();
        }
    } catch (e) { }

    await page.type('input[name="q"]', 'Street Food Trucks in Brixton');
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 5000));

    const articles = await page.$$('div[role="article"]');
    console.log(`Found ${articles.length} articles`);

    if (articles.length === 0) {
        const html = await page.content();
        // maybe check if there's an error message or "No results found"
        const noResults = await page.$eval('body', el => el.innerText.includes('No results found') || el.innerText.includes('can\'t find'));
        console.log('Contains No results found?', noResults);

        // capture screenshot
        await page.screenshot({ path: 'brixton_test.png' });
    }

    await browser.close();
})();
