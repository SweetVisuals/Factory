const fs = require('fs');
const path = require('path');

console.log('--- DIAGNOSTIC START ---');
console.log('Directory:', process.cwd());
console.log('Node:', process.versions.node);
console.log('Module Paths:', module.paths);

try {
    const puppeteer = require('puppeteer');
    console.log('[SUCCESS] Puppeteer Found!');
    console.log('Path:', require.resolve('puppeteer'));

    // Optional: Test launch
    (async () => {
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('[SUCCESS] Browser Launched!');
            await browser.close();
        } catch (e) {
            console.log('[FAIL] Browser Launch Failed:', e.message);
        }
    })();
} catch (e) {
    console.log('[FAIL] Puppeteer Missing:', e.message);
}

try {
    const sparticuz = require('@sparticuz/chromium');
    console.log('[SUCCESS] @sparticuz/chromium Found!');
} catch (e) {
    console.log('[FAIL] @sparticuz/chromium Missing:', e.message);
}

try {
    const core = require('puppeteer-core');
    console.log('[SUCCESS] puppeteer-core Found!');
} catch (e) {
    console.log('[FAIL] puppeteer-core Missing:', e.message);
}

console.log('--- DIAGNOSTIC END ---');
