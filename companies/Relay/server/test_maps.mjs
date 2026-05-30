import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-features=IsolateOrigins,site-per-process',
      '--blink-settings=imagesEnabled=false'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const query = "event planners in Camden, London";
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
  
  console.log(`Navigating directly to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

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
        console.log("Handled consent button clicked.");
        break;
      }
    }
  } catch (e) {
    console.log("Consent check skipped/failed:", e.message);
  }

  console.log("Waiting 10 seconds for results to render...");
  await new Promise(r => setTimeout(r, 10000));

  await page.screenshot({ path: 'step3_results.png' });
  console.log("Saved step3_results.png");

  const html = await page.content();
  fs.writeFileSync('page_content.html', html);
  console.log("Saved page_content.html");

  const elements = await page.$$('div[role="article"], a[href*="/maps/place/"], .Nv2PK, div[data-result-index]');
  console.log(`Found elements count matching selectors: ${elements.length}`);

  const isSingleResult = await page.evaluate(() => {
    const titleEl = document.querySelector('h1.DUwDvf');
    const feedEl = document.querySelector('div[role="feed"]');
    return !!titleEl && !feedEl;
  });
  console.log(`Is single result page: ${isSingleResult}`);

  // Print first few elements' inner text to verify they are real businesses
  if (elements.length > 0) {
    console.log("--- Sample Results ---");
    for (let i = 0; i < Math.min(3, elements.length); i++) {
      const text = await elements[i].evaluate(el => el.innerText);
      console.log(`Result ${i + 1}: ${text.split('\n')[0]}`);
    }
  }

  await browser.close();
  console.log("Browser closed.");
}

run().catch(console.error);
