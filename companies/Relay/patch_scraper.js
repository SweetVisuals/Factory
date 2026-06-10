import fs from 'fs';

const filePath = 'c:/Users/Shadow/Desktop/Factory/companies/Relay/server/scraper.mjs';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// 1. Add imports at the top
if (!content.includes("import axios from 'axios';")) {
    lines.splice(6, 0, "import axios from 'axios';", "import * as cheerio from 'cheerio';");
}

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export async function scrapeGoogleMaps(')) {
        startIdx = i;
    }
    if (startIdx !== -1 && i > startIdx && lines[i].includes('export async function scrapeLinkedIn(')) {
        endIdx = i - 1;
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    const newFunc = `
export async function scrapeGoogleMaps(query, limit = 50, onLog = null, onResult = null, notesContext = '', deepResearch = false, checkState = null) {
    const log = createLogger(onLog);
    log(\`Starting Fast API scraper for: \${query} (Target: \${limit})\`);
    
    let leads = [];
    try {
        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey) {
            log('CRITICAL: SERPER_API_KEY is not set in .env! Cannot perform fast scraping.');
            return [];
        }

        log(\`Fetching Google Maps data from Serper API...\`);
        const response = await axios({
            method: 'post',
            url: 'https://google.serper.dev/places',
            headers: { 
                'X-API-KEY': apiKey, 
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                "q": query,
                "num": limit
            })
        });

        const places = response.data.places || [];
        log(\`Found \${places.length} raw places from API.\`);

        for (const place of places) {
            if (checkState) await checkState();
            if (leads.length >= limit) break;

            const name = place.title || '';
            let website = place.website || '';
            const phone = place.phoneNumber || '';
            const address = place.address || '';
            
            if (!name) continue;

            let email = '';
            let social = { linkedin: '', facebook: '', twitter: '', instagram: '' };

            // Fast deep scrape if website exists
            if (website && !website.includes('google.com')) {
                if (!website.startsWith('http')) website = 'http://' + website;
                
                try {
                    log(\`Fast-scanning website: \${website}\`);
                    const webRes = await axios.get(website, { 
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });
                    const html = webRes.data;
                    const $ = cheerio.load(html);
                    
                    // Extract Emails via Regex
                    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)/gi;
                    const textContent = $('body').text();
                    const emails = textContent.match(emailRegex) || [];
                    
                    const validEmails = emails.filter(e => {
                        const low = e.toLowerCase();
                        return !low.endsWith('.png') && !low.endsWith('.jpg') && !low.includes('sentry') && !low.includes('example');
                    });
                    
                    if (validEmails.length > 0) email = validEmails[0];
                    
                    $('a').each((i, el) => {
                        const href = $(el).attr('href');
                        if (href) {
                            if (href.includes('linkedin.com/company')) social.linkedin = href;
                            if (href.includes('facebook.com') && !href.includes('sharer')) social.facebook = href;
                            if (href.includes('instagram.com')) social.instagram = href;
                            if (href.includes('twitter.com') || href.includes('x.com')) social.twitter = href;
                        }
                    });

                } catch (e) {
                    log(\`Failed to fast-scan \${website}: \${e.message}\`);
                }
            }

            const lead = {
                id: \`scraped-\${Math.random().toString(36).substr(2, 9)}\`,
                name: '',
                title: '',
                status: 'New',
                company: name,
                email, 
                phone, 
                website, 
                summary: '',
                role: '',
                twitter: social.twitter, 
                facebook: social.facebook, 
                instagram: social.instagram, 
                linkedin: social.linkedin, 
                tiktok: '',
                location: address,
                source: 'Fast API'
            };

            log(\`Found: \${name} (Email: \${email || 'No'} | Phone: \${phone || 'No'} | Website: \${website || 'No'})\`);
            
            leads.push(lead);
            if (onResult && typeof onResult === 'function') {
                onResult(lead).catch(err => log(\`Error in onResult callback: \${err.message}\`));
            }
        }
        
        log(\`Scraping Complete. Successfully extracted \${leads.length} leads.\`);
        return leads;
    } catch (e) {
        log(\`Error in Fast API Scraper: \${e.message}\`);
        return leads;
    }
}
`;
    lines.splice(startIdx, endIdx - startIdx + 1, newFunc);
    
    // Join with proper newline
    const result = lines.join(String.fromCharCode(10));
    fs.writeFileSync(filePath, result);
    console.log("Successfully replaced scrapeGoogleMaps");
} else {
    console.log("Could not find boundaries for scrapeGoogleMaps");
}
