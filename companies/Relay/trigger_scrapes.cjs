const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .or('name.ilike.%ai%automation%,name.ilike.%wedding%');

  if (error) {
    console.error('Error fetching campaigns:', error);
    process.exit(1);
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No matching campaigns found.');
    process.exit(0);
  }

  console.log(`Found ${campaigns.length} campaigns to trigger.`);

  for (const c of campaigns) {
    console.log(`Triggering scrape for: ${c.name} (${c.id})`);
    
    try {
      const resp = await fetch('https://api.relaysolutions.net/api/scrape-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({
          business: c.niche || c.name,
          location: 'United States', // fallback, backend auto-detects from name if present
          limit: 15,
          campaignId: c.id,
          keywords: c.niche || c.name,
          deepResearch: true
        })
      });

      const result = await resp.text();
      console.log(`Status: ${resp.status}, Response: ${result}`);
      
      // Wait a few seconds to avoid immediate 429
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      console.error(`Fetch failed for ${c.name}:`, e.message);
    }
  }
}

run();
