import { createClient } from '@supabase/supabase-js';

let supabase = null;
const getBackendUrl = () => `http://127.0.0.1:${process.env.PORT || 3000}`;

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runScraperScheduler() {
  console.log('[Scraper Scheduler] Checking for active campaigns to feed leads...');
  try {
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    // Get active campaigns
    const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
            id, name, status, business_id, niche,
            businesses!inner (
                id, name, status
            )
        `)
        .eq('businesses.status', 'active')
        .in('status', ['draft', 'Draft', 'in_progress', 'active']);

    if (campaignError) {
        throw campaignError;
    }

    if (!campaigns || campaigns.length === 0) {
        console.log('[Scraper Scheduler] No active campaigns found.');
        return;
    }

    let startedCount = 0;

    for (const c of campaigns) {
        // Find out how many leads this campaign currently has
        const { count, error: countError } = await supabase
            .from('campaign_leads')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', c.id);
            
        if (countError) {
            console.error(`[Scraper Scheduler] Error fetching lead count for ${c.id}:`, countError.message);
            continue;
        }

        // Always feed leads to active campaigns
        if (count !== null) {
            // Derive niche from the actual `niche` column
            let niche = c.niche;

            // Extract location from campaign name (e.g. "Film & TV On-Set Medical Cover (London/SE)")
            let location = '';
            const nameStr = c.name || '';
            const parenMatch = nameStr.match(/\(([^)]+)\)/);
            if (parenMatch) {
                location = parenMatch[1]; // e.g. "London/SE", "London & Midlands"
            }

            if (!niche) {
                const nameLower = nameStr.toLowerCase();
                niche = nameLower.includes('roofing') ? 'roofing contractors' :
                        nameLower.includes('ecom') ? 'ecommerce stores' :
                        nameLower.includes('legal') ? 'law firm' :
                        nameLower.includes('cyber') ? 'cybersecurity' : 'business';
            }

            if (!location) {
                const nameLower = nameStr.toLowerCase();
                location = nameLower.includes('uk') || nameLower.includes('london') || nameLower.includes('midlands') ? 'United Kingdom' : 'United States';
            }

            console.log(`[Scraper Scheduler] Feeding campaign "${c.name}" — current leads: ${count}, requesting 50 more`);

            try {
                // Trigger Node.js scraper endpoint using the local loopback
                const resp = await fetch(`${getBackendUrl()}/api/scrape-leads`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}` // Uses admin bypass key
                    },
                    body: JSON.stringify({
                        business: niche,
                        location: location,
                        limit: 50,
                        campaignId: c.id,
                        keywords: niche,
                        deepResearch: false // Rely on regex fast-mode
                    })
                });

                if (resp.ok) {
                    const result = await resp.json();
                    console.log(`[Scraper Scheduler] Successfully triggered scraper for ${c.id}. Response:`, result);
                    startedCount++;
                } else {
                    console.error(`[Scraper Scheduler] Failed to trigger scraper for ${c.id}. Status: ${resp.status}`);
                }
            } catch (err) {
                console.error(`[Scraper Scheduler] Network error triggering scraper for ${c.id}:`, err.message);
            }
            
            // Wait 2 seconds before queuing the next campaign to avoid hitting concurrency bumps too fast
            await sleep(2000);
        } else {
            console.log(`[Scraper Scheduler] Campaign "${c.name}" has sufficient leads (${count}). Skipping.`);
        }
    }

    console.log(`[Scraper Scheduler] Run complete. Checked ${campaigns.length} campaigns, started ${startedCount} scrapes.`);

  } catch (error) {
    console.error("[Scraper Scheduler] Run failed:", error.message);
  }
}

export function startScraperSchedulerCron() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Scraper Scheduler] Missing Supabase credentials. Cron will not start.');
    return;
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[Scraper Scheduler] Initialized. Running every 15 minutes.');
  
  // Wait a minute on startup before running so server has time to boot fully
  setTimeout(() => {
    runScraperScheduler();
    // Run every 15 minutes (15 * 60 * 1000)
    setInterval(runScraperScheduler, 15 * 60 * 1000);
  }, 60 * 1000);
}
