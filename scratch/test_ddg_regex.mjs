
import https from 'https';

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function testDDG() {
    const query = 'law firm New York';
    console.log(`Searching DuckDuckGo for: ${query}`);
    
    try {
        const html = await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
        console.log(`Response length: ${html.length}`);
        
        // The regex from scraper_http.mjs
        const matches = [...html.matchAll(/<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
        console.log(`Found ${matches.length} matches with current regex`);
        
        if (matches.length === 0) {
            console.log('Regex failed. Investigating HTML structure...');
            // Check for any links with result__url class
            const links = html.match(/<a[^>]+class="[^"]*result__url[^"]*"[^>]*>/g) || [];
            console.log(`Found ${links.length} links with class "result__url"`);
            if (links.length > 0) {
                console.log('Sample link:', links[0]);
            }
            
            // Try an alternative regex if the first one failed
            const altRegex = /<a[^>]+href="([^"]+)"[^>]*class="result__url"[^>]*>([\s\S]*?)<\/a>/g;
            const altMatches = [...html.matchAll(altRegex)];
            console.log(`Found ${altMatches.length} matches with alternative regex`);
        } else {
            console.log('Sample result:', matches[0][1], matches[0][2].trim());
        }
        
    } catch (error) {
        console.error(`Search failed: ${error.message}`);
    }
}

testDDG();
