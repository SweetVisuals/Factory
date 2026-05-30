import { scrapeGoogleMaps } from './scraper.mjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    console.log('--- STARTING GOOGLE MAPS SELECTOR DIAGNOSTIC ---');
    
    // We will call scrapeGoogleMaps with a test query and intercept logs
    const query = 'Roofing in Austin';
    
    const results = await scrapeGoogleMaps(
        query, 
        2, 
        (logMsg) => {
            console.log(`[SCRAPER LOG]: ${logMsg}`);
        },
        async (result) => {
            console.log(`[SCRAPER RESULT]: Found lead:`, result);
        },
        '',
        false
    );
    
    console.log('--- DIAGNOSTIC COMPLETED ---');
    console.log(`Leads returned: ${results.length}`);
}

run().catch(err => {
    console.error('Fatal Error running diagnostic:', err);
});
