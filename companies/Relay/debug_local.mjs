import { scrapeGoogleMaps } from './server/scraper.mjs';

(async () => {
    console.log("Starting test...");
    try {
        const results = await scrapeGoogleMaps('restaurants in new york', 5, console.log);
        console.log(`Test finished. Found ${results.length} results.`);
    } catch (e) {
        console.error("Test failed with error:", e);
    }
})();
