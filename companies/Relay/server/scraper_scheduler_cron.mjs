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
            id, name, status, business_id, niche,
            businesses!inner (
                id, name, status
            )
        `)
        .eq('businesses.status', 'active')
        .in('status', ['in_progress', 'active']);

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

            console.log(`[Scraper Scheduler] Feeding campaign "${c.name}" — current leads: ${count}, requesting 500 more`);

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
                        limit: 250,
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
            
            // Blast through queue with minimal delay
            await sleep(100);
        } else if (count !== null && count >= 5000) {
            console.log(`[Scraper Scheduler] Campaign "${c.name}" has hit the 5000 limit (${count}). Checking for auto-duplication.`);
            
            // Check if a clone already exists by finding the highest Part number
            const baseName = c.name.replace(/\s*\(Part \d+\)$/, '').trim();
            const { data: existingClones } = await supabase
                .from('campaigns')
                .select('name')
                .ilike('name', `${baseName} (Part %`);
                
            let nextPartNumber = 2;
            if (existingClones && existingClones.length > 0) {
                for (const clone of existingClones) {
                    const match = clone.name.match(/\(Part (\d+)\)$/);
                    if (match && match[1]) {
                        const num = parseInt(match[1]);
                        if (num >= nextPartNumber) nextPartNumber = num + 1;
                    }
                }
            }
            
            const newCampaignName = `${baseName} (Part ${nextPartNumber})`;
            const { data: exactMatch } = await supabase.from('campaigns').select('id').eq('name', newCampaignName).maybeSingle();
            
            if (!exactMatch) {
                console.log(`[Scraper Scheduler] Auto-duplicating campaign into: "${newCampaignName}"`);
                const { data: fullCampaign } = await supabase.from('campaigns').select('*').eq('id', c.id).single();
                
                if (fullCampaign) {
                    const { id, created_at, updated_at, prospects, replies, open_rate, click_rate, businesses, current_step, ...campaignDataToClone } = fullCampaign;
                    campaignDataToClone.name = newCampaignName;
                    campaignDataToClone.status = 'active';
                    
                    const { data: newCampaign, error: createErr } = await supabase
                        .from('campaigns')
                        .insert(campaignDataToClone)
                        .select('id')
                        .single();
                        
                    if (newCampaign && newCampaign.id) {
                        const newCampaignId = newCampaign.id;
                        
                        // Clone schedules
                        const { data: schedules } = await supabase.from('scheduled_emails').select('*').eq('campaign_id', c.id);
                        if (schedules && schedules.length > 0) {
                            const newSchedules = schedules.map(s => {
                                const { id, created_at, updated_at, campaign_id, sent_emails, failed_emails, ...schedData } = s;
                                return { ...schedData, campaign_id: newCampaignId };
                            });
                            await supabase.from('scheduled_emails').insert(newSchedules);
                        }
                        
                        // Clone email accounts
                        const { data: accounts } = await supabase.from('campaign_email_accounts').select('*').eq('campaign_id', c.id);
                        if (accounts && accounts.length > 0) {
                            const newAccounts = accounts.map(a => {
                                const { id, created_at, campaign_id, ...accData } = a;
                                return { ...accData, campaign_id: newCampaignId };
                            });
                            await supabase.from('campaign_email_accounts').insert(newAccounts);
                        }
                        console.log(`[Scraper Scheduler] Successfully cloned campaign into ${newCampaignId}`);
                    } else {
                        console.error(`[Scraper Scheduler] Failed to duplicate campaign:`, createErr);
                    }
                }
            } else {
                console.log(`[Scraper Scheduler] Clone "${newCampaignName}" already exists. Skipping duplication.`);
            }
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

  console.log('[Scraper Scheduler] Initialized. Running every 60 seconds.');
  
  // Wait a few seconds on startup before running so server has time to boot fully
  setTimeout(() => {
    runScraperScheduler();
    // Run every 10 minutes
    setInterval(runScraperScheduler, 10 * 60 * 1000);
  }, 5 * 1000);
}
