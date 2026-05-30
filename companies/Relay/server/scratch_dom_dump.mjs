import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
    console.log('Launching browser for DOM inspection...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--blink-settings=imagesEnabled=false'
        ]
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        console.log('Navigating to Google Maps...');
        await page.goto('https://www.google.com/maps?hl=en&gl=us', { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Consent handle
        try {
            const consentBtn = await page.$('button[aria-label="Accept all"]');
            if (consentBtn) {
                await consentBtn.click();
                await page.waitForNavigation({ timeout: 5000 }).catch(() => {});
                console.log('Consent accepted.');
            }
        } catch (e) {}

        console.log('Searching for "Roofing in Austin"...');
        await page.waitForSelector('input[name="q"]', { timeout: 10000 });
        await page.type('input[name="q"]', 'Roofing in Austin');
        await page.keyboard.press('Enter');
        
        console.log('Waiting 8 seconds for results to load...');
        await new Promise(r => setTimeout(r, 8000));
        
        // Let's capture the outerHTML structure
        console.log('Analyzing search results elements...');
        
        const domInfo = await page.evaluate(() => {
            const results = [];
            
            // 1. Let's find all anchors that link to places
            const placeLinks = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
            results.push(`Found ${placeLinks.length} place links.`);
            
            // 2. Let's analyze their outerHTML or parents
            placeLinks.slice(0, 5).forEach((link, i) => {
                const parent = link.parentElement;
                const parent2 = parent ? parent.parentElement : null;
                const parent3 = parent2 ? parent2.parentElement : null;
                const parent4 = parent3 ? parent3.parentElement : null;
                
                results.push(`\n[Link ${i + 1}]:`);
                results.push(`  Href: ${link.href.substring(0, 100)}...`);
                results.push(`  Link Text: ${link.innerText.replace(/\n/g, ' ')}`);
                results.push(`  Link Role: ${link.getAttribute('role') || 'None'}`);
                results.push(`  Link Classes: ${link.className}`);
                
                if (parent) {
                    results.push(`  Parent Tag: ${parent.tagName}, Role: ${parent.getAttribute('role') || 'None'}, Class: ${parent.className}`);
                }
                if (parent2) {
                    results.push(`  Parent2 Tag: ${parent2.tagName}, Role: ${parent2.getAttribute('role') || 'None'}, Class: ${parent2.className}`);
                }
                if (parent3) {
                    results.push(`  Parent3 Tag: ${parent3.tagName}, Role: ${parent3.getAttribute('role') || 'None'}, Class: ${parent3.className}`);
                }
                if (parent4) {
                    results.push(`  Parent4 Tag: ${parent4.tagName}, Role: ${parent4.getAttribute('role') || 'None'}, Class: ${parent4.className}`);
                }
            });
            
            // 3. Find any element with role="article"
            const articles = Array.from(document.querySelectorAll('[role="article"]'));
            results.push(`\nFound ${articles.length} elements with role="article".`);
            articles.slice(0, 3).forEach((art, i) => {
                results.push(`  Article ${i + 1} tag: ${art.tagName}, class: ${art.className}, label: ${art.getAttribute('aria-label')}`);
            });
            
            // 4. Let's dump all element tags inside the feed
            const feed = document.querySelector('div[role="feed"]');
            if (feed) {
                results.push(`\nFeed element found. Classes: ${feed.className}`);
                const feedChildren = Array.from(feed.children);
                results.push(`  Feed has ${feedChildren.length} children.`);
                feedChildren.slice(0, 10).forEach((c, idx) => {
                    results.push(`    Child ${idx}: Tag=${c.tagName}, Class="${c.className}", Role="${c.getAttribute('role') || 'none'}", TextPrefix="${c.innerText.substring(0, 30).replace(/\n/g, ' ')}"`);
                });
            } else {
                results.push(`\nFeed element not found.`);
            }
            
            return results.join('\n');
        });
        
        console.log('--- DOM INFO RESULTS ---');
        console.log(domInfo);
        
    } catch (e) {
        console.error('Error during DOM dump:', e);
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
}

run();
