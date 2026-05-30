import { scrapeGoogleMaps } from './scraper.mjs';

async function run() {
    console.log('Testing scrapeGoogleMaps correctly...');
    try {
        const results = await scrapeGoogleMaps('plumbers in london', 2, console.log);
        console.log('Final Results:', results.length);
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
