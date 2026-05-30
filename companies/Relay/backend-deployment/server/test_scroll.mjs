import puppeteerExtraPKG from 'puppeteer-extra';
const addExtra = puppeteerExtraPKG.addExtra;
import puppeteer from 'puppeteer';
const pupExtra = addExtra(puppeteer);
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

pupExtra.use(StealthPlugin());

async function run() {
    const browser = await pupExtra.launch({ headless: 'new', args: ['--window-size=1440,900'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // Consent
    const consentSelectors = ['button[aria-label="Accept all"]', 'form[action*="consent"] button'];
    for (const sel of consentSelectors) {
        if (await page.$(sel)) { await page.click(sel); break; }
    }

    await new Promise(r => setTimeout(r, 2000));
    await page.type('#searchboxinput', 'plumbers in london');
    await page.keyboard.press('Enter');

    try { await page.waitForSelector('div[role="feed"]', { timeout: 10000 }); } catch (e) { }

    let prevCount = 0;
    for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const currentCount = (await page.$$('div[role="article"]')).length;
        console.log(`Scroll ${i}: Found ${currentCount} results`);

        if (currentCount === prevCount && i > 0) {
            console.log('No new results. Trying different scroll...');
            // Technique 2: Hover over last element and scroll wheel
            const els = await page.$$('div[role="article"]');
            if (els.length > 0) {
                const rect = await els[els.length - 1].boundingBox();
                if (rect) {
                    await page.mouse.move(rect.x, rect.y);
                    await page.mouse.wheel({ deltaY: 5000 });
                }
            }
        } else {
            // Technique 1: Scroll feed div
            await page.evaluate(() => {
                const el = document.querySelector('div[role="feed"]');
                if (el) el.scrollBy(0, 5000);
            });
        }

        prevCount = currentCount;
    }

    await browser.close();
}
run();
