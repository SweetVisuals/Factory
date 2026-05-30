import axios from 'axios';
import fs from 'fs';

async function testDDG() {
    const query = 'dentist in new york';
    console.log(`Searching DuckDuckGo for: ${query}`);
    try {
        const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        const html = response.data;
        fs.writeFileSync('ddg_test.html', html);
        console.log(`Saved HTML to ddg_test.html. Length: ${html.length}`);
        
        const matches = [...html.matchAll(/<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
        console.log(`Regex matches: ${matches.length}`);
        
        matches.slice(0, 5).forEach((m, i) => {
            console.log(`Match ${i+1}: URL=${m[1]}, Title=${m[2].replace(/<[^>]+>/g, '').trim()}`);
        });
    } catch (error) {
        console.error('Search failed:', error.message);
    }
}

testDDG();
