import { createClient } from '@supabase/supabase-js';

let supabase = null;
const getBackendUrl = () => `http://127.0.0.1:${process.env.PORT || 3000}`;

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runScraperScheduler() {
  console.log('[Scraper Scheduler] Checking for active campaigns to feed leads...');
  try {
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    const { data: memData } = await supabase.from('agent_memory').select('value').eq('key_name', 'factory_status').maybeSingle();
    if (memData?.value?.status === 'paused' && memData?.value?.reason !== 'insufficient_credits') {
      console.log(`[Scraper Scheduler] Factory is paused for reason: ${memData?.value?.reason}. Skipping scraper schedule.`);
      return;
    }

    // Get active campaigns
    const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
            id, name, status, niche, user_id
        `)
        .in('status', ['in_progress', 'active', 'draft', 'review']);

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

        // Fetch user account settings
        const { data: accSettings, error: accErr } = await supabase
            .from('account_settings')
            .select('*')
            .eq('user_id', c.user_id)
            .maybeSingle();

        if (!accSettings) {
             console.log(`[Scraper Scheduler] No account settings found for user ${c.user_id}. Skipping campaign ${c.id}.`);
             continue;
        }

        if (!accSettings.is_scraping_active) {
             console.log(`[Scraper Scheduler] User ${c.user_id} has paused scraping. Skipping campaign ${c.id}.`);
             continue;
        }

        if (accSettings.plan_type === 'free' && accSettings.scrapes_this_month >= 2500) {
             console.log(`[Scraper Scheduler] User ${c.user_id} has hit free tier limit (2500). Skipping campaign ${c.id}.`);
             continue;
        }

        // Max out server: feed leads to campaigns under 5000 leads
        if (count !== null && count < 5000) {
            // AI is disabled in Normal Mode. We always check tasks to avoid duplicates.
            const hasAiCredits = true; // Force task checking

            if (hasAiCredits) {
                // Check if there is an active scraper task for this campaign in the database
                try {
                    const { data: activeTasks, error: taskCheckErr } = await supabase
                        .from('tasks')
                        .select('id, description')
                        .eq('assigned_to', 'Scraper')
                        .in('status', ['in_progress', 'pending', 'waiting']);
                    
                    if (taskCheckErr) {
                        console.error(`[Scraper Scheduler] Error checking active tasks for ${c.id}:`, taskCheckErr.message);
                    } else if (activeTasks) {
                        // Only 1 scraper per campaign to avoid overloading the DB
                        const isAlreadyRunning = activeTasks.some(t => t.description && t.description.includes(c.id));
                        if (isAlreadyRunning) {
                            console.log(`[Scraper Scheduler] Campaign "${c.name}" (${c.id}) already has an active task. Skipping.`);
                            continue;
                        }
                    }
                } catch (err) {
                    console.error(`[Scraper Scheduler] Exception checking active tasks for ${c.id}:`, err.message);
                }
            }

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
                // User explicitly requested all defaults to be UK. Only match US if it's a standalone word.
                const isUS = /\bus\b/.test(nameLower) || nameLower.includes('united states') || nameLower.includes('america');
                location = isUS ? 'United States' : 'United Kingdom';
            }

            const scrapeLimit = Math.floor(Math.random() * 5) + 1; // Random 1 - 5 leads
            console.log(`[Scraper Scheduler] Feeding campaign "${c.name}" — current leads: ${count}, requesting ${scrapeLimit} more (controlled pace)`);

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
                        limit: scrapeLimit, // Limit of 1-5 leads per run
                        campaignId: c.id,
                        keywords: niche,
                        deepResearch: true // Force all new leads into deep research queue
                    })
                });

                if (resp.ok) {
                    const result = await resp.json();
                    console.log(`[Scraper Scheduler] Successfully triggered scraper for ${c.id}. Response:`, result);
                    startedCount++;
                    
                    // Increment scrape counter
                    await supabase.rpc('increment_scrapes', { uid: c.user_id, amount: scrapeLimit }).catch(e => {
                        // fallback if RPC doesn't exist
                        supabase.from('account_settings').update({ scrapes_this_month: (accSettings.scrapes_this_month || 0) + scrapeLimit }).eq('user_id', c.user_id).then();
                    });
                } else {
                    console.error(`[Scraper Scheduler] Failed to trigger scraper for ${c.id}. Status: ${resp.status}`);
                }
            } catch (err) {
                console.error(`[Scraper Scheduler] Network error triggering scraper for ${c.id}:`, err.message);
            }
            
            // Blast through queue with minimal delay
            await sleep(100);
        } else if (count !== null && count >= 5000) {
            console.log(`[Scraper Scheduler] Campaign "${c.name}" has hit the 5000 limit (${count}). Auto-duplication is currently disabled to prevent out of control API consumption.`);
        } else {
            console.log(`[Scraper Scheduler] Campaign "${c.name}" has sufficient leads (${count}) but less than 5000. Skipping.`);
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

  console.log('[Scraper Scheduler] Initialized. Running every 5 minutes.');
  
  // Wait a few seconds on startup before running so server has time to boot fully
  setTimeout(() => {
    runScraperScheduler();
    // Run every 5 minutes
    setInterval(runScraperScheduler, 5 * 60 * 1000);
  }, 5 * 1000);
}
