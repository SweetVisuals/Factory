import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8' });

    console.log('Navigating to maps...');
    await page.goto('https://www.google.com/maps?hl=en', { waitUntil: 'networkidle2' });

    // Accept cookies if present
    console.log('Checking for consent...');
    try {
        const acceptBtns = await page.$$('button');
        for (const btn of acceptBtns) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text.includes('Accept all') || text.includes('Alle akzeptieren')) {
                await btn.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null);
                break;
            }
        }
    } catch (e) { }

    await new Promise(r => setTimeout(r, 2000));

    console.log('Typing search...');
    try {
        await page.waitForSelector('#searchboxinput', { timeout: 10000 });
        await page.type('#searchboxinput', 'Street Food Trucks in Brixton');
    } catch (e) {
        await page.waitForSelector('input[name="q"]', { timeout: 10000 });
        await page.type('input[name="q"]', 'Street Food Trucks in Brixton');
    }
    await page.keyboard.press('Enter');

    console.log('Waiting for results...');
    await new Promise(r => setTimeout(r, 8000));

    const articles = await page.$$('div[role="article"]');
    console.log(`Found ${articles.length} articles`);

    const html = await page.content();
    fs.writeFileSync('brixton_debug.html', html);
    await page.screenshot({ path: 'brixton_test.png' });

    await browser.close();
    console.log('Done.');
})();
