import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData) { console.log('Auth failed'); return; }

  const token = authData.session.access_token;
  
  const scraperUrl = 'http://localhost:3001/api/scrape-leads';
  
  const targets = [
    {
      name: "Corporate Venues, Hotels & Business Centres Medical Cover (London & Midlands)",
      id: "08ac1024-d0c7-4535-b600-658368ffb383",
      business: "hotels with conference facilities",
      location: "London",
      keywords: "hotel conference venue business centre corporate events",
      limit: 15
    },
    {
      name: "Event Venues & Music Festivals Medical Cover (London & Midlands)",
      id: "1f36b9d6-563e-49b7-9906-def19d3b00dc",
      business: "live music venues",
      location: "London",
      keywords: "live music venue concert hall festival site",
      limit: 15
    },
    {
      name: "Private Functions, School Events & Sports Cover (Midlands)",
      id: "660464ed-4db6-4028-b640-b4f0a03cecea",
      business: "rugby clubs",
      location: "Birmingham",
      keywords: "amateur rugby club sports ground",
      limit: 15
    }
  ];

  for (const t of targets) {
    console.log(`\nTriggering scrape for ${t.name}...`);
    try {
        const resp = await fetch(scraperUrl, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
            business: t.business,
            location: t.location,
            limit: t.limit,
            campaignId: t.id,
            keywords: t.keywords
            })
        });
        const json = await resp.json();
        console.log(`  Response: ${resp.status} ${JSON.stringify(json).substring(0, 200)}`);
    } catch (e) {
        console.log("  Error: " + e.message);
    }
  }
}

main().catch(console.error);
