import { createClient } from '@supabase/supabase-js';
import { performDeterministicResearch } from './scraper_tools.mjs';

let supabase = null;
const BATCH_SIZE = 10; // Process 10 leads per run to avoid blowing up the DB/server

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runReputationScheduler() {
  console.log('[Reputation Scheduler] Checking for leads needing reputation scanning...');
  try {
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    // Fetch leads where bad_reviews is missing, and we have a company name or website.
    // Ensure we don't query leads that have already been fully researched.
    // To identify leads needing scan, we look for research_status != 'completed' or missing bad_reviews.
    // Since deep research populates bad_reviews, if bad_reviews is null, it means it hasn't been scanned.
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('review_count', 0)
        .limit(BATCH_SIZE);

    if (error) {
        throw error;
    }

    if (!leads || leads.length === 0) {
        console.log('[Reputation Scheduler] No leads found needing reputation scan.');
        return;
    }

    console.log(`[Reputation Scheduler] Found ${leads.length} leads. Running research...`);

    for (const lead of leads) {
        console.log(`[Reputation Scheduler] Researching lead: ${lead.company} (${lead.id})`);
        
        try {
            // Update status to prevent other workers from picking it up
            await supabase.from('leads').update({ research_status: 'pending' }).eq('id', lead.id);

            // Execute ONLY the Deterministic Scraper (No AI!) to save API costs
            const jsonStr = await performDeterministicResearch(lead.company || lead.name, lead.website || '', '');
            
            if (jsonStr && !jsonStr.includes('"error":')) {
                const parsed = JSON.parse(jsonStr);
                
                // Manually map the raw scraper output directly to the database to bypass AI completely
                const updateData = {
                    research_status: 'completed',
                    researched_at: new Date().toISOString(),
                    review_count: parsed.google_data?.reviews ? parseInt(parsed.google_data.reviews.replace(/,/g, ''), 10) : 0,
                    bad_reviews: parsed.bad_reviews || []
                };

                const { error: updateError } = await supabase
                    .from('leads')
                    .update(updateData)
                    .eq('id', lead.id);
                    
                if (updateError) {
                    console.error(`[Reputation Scheduler] Failed to save research for ${lead.id}:`, updateError.message);
                } else {
                    console.log(`[Reputation Scheduler] Successfully researched (NO AI) and updated lead: ${lead.id}`);
                }
            } else {
                console.error(`[Reputation Scheduler] Research failed for ${lead.id}:`, jsonStr);
                await supabase.from('leads').update({ research_status: 'failed' }).eq('id', lead.id);
            }
        } catch (err) {
            console.error(`[Reputation Scheduler] Exception processing lead ${lead.id}:`, err.message);
            await supabase.from('leads').update({ research_status: 'error' }).eq('id', lead.id);
        }

        // Slight pause between leads to allow Chrome resources to free up
        await sleep(3000);
    }

    console.log(`[Reputation Scheduler] Run complete.`);

  } catch (error) {
    console.error("[Reputation Scheduler] Run failed:", error.message);
  }
}

export function startReputationSchedulerCron() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Reputation Scheduler] Missing Supabase credentials. Cron will not start.');
    return;
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[Reputation Scheduler] Initialized. Running every 15 minutes.');
  
  // Wait a few seconds on startup before running so server has time to boot fully
  setTimeout(async () => {
    // Run the scheduler
    runReputationScheduler();
    
    // Run every 15 minutes to avoid hitting Google's rate limits too aggressively
    setInterval(runReputationScheduler, 15 * 60 * 1000);
  }, 15 * 1000); // Start 15s after boot
}
