import { scrapeCompaniesHouse } from './scraper.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function test() {
    console.log("Starting test...");
    try {
        const leads = await scrapeCompaniesHouse('roofing', 2, console.log);
        console.log("RESULTS:", leads);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
