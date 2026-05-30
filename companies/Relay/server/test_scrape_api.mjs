import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const token = process.env.SUPABASE_ANON_KEY;

async function testScraper() {
    console.log('Triggering scrape for "Lawyers in London"...');
    try {
        const response = await axios.post('http://localhost:3001/api/scrape-leads', {
            business: 'Lawyers',
            location: 'London',
            limit: 5,
            platforms: { all: true }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error triggering scrape:', error.response?.data || error.message);
    }
}

testScraper();
