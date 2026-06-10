import { createClient } from '@supabase/supabase-js';
import { runProcessCampaign } from './process_campaign_node.mjs';
import { performDeepResearch } from './scraper.mjs';

let supabase = null;
let isRunning = false;
let isResearching = false;

async function runAutoResearch() {
  if (!supabase) return;
  if (isResearching) {
    console.log('[Auto-Research] Previous research cycle still running. Skipping research.');
    return;
  }
  isResearching = true;
  try {
    // Find leads in active campaigns that have a website but no/weak summary
    const { data: rows, error } = await supabase
      .from('campaign_leads')
      .select('lead_id, campaigns!inner(id, status), leads!inner(id, name, company, website, summary)')
      .eq('campaigns.status', 'in_progress')
      .limit(30);

    if (error || !rows || rows.length === 0) return;

    // Filter for leads that actually need research
    const needsResearch = rows
      .filter(r => {
        const lead = r.leads;
        if (!lead?.website) return false;
        if (lead.summary && lead.summary.length > 50) return false; // Already has research
        return true;
      })
      .slice(0, 5); // Max 5 per cycle to avoid blocking sends

    if (needsResearch.length === 0) return;

    console.log(`[Auto-Research] Found ${needsResearch.length} unresearched leads. Starting Puppeteer research...`);

    for (const row of needsResearch) {
      const lead = row.leads;
      if (!lead?.website) continue;
      try {
        const company = lead.company || lead.name || 'Unknown';
        const website = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
        console.log(`[Auto-Research] Researching ${company} (${website})...`);
        const report = await performDeepResearch(company, website);
        if (report) {
          await supabase
            .from('leads')
            .update({ summary: report })
            .eq('id', lead.id);
          console.log(`[Auto-Research] ✅ Saved research for ${company}`);
        }
      } catch (err) {
        console.error(`[Auto-Research] ❌ Failed for ${lead.company || 'Unknown'}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[Auto-Research] Error:', err.message);
  } finally {
    isResearching = false;
  }
}

async function runEmailerCron() {
  if (isRunning) {
    console.log('[Emailer Cron] Previous cycle still running. Skipping.');
    return;
  }
  isRunning = true;
  try {
    console.log('[Emailer Cron] Triggering background auto-research + running campaign processing...');
    // Trigger auto-research in background (decoupled)
    runAutoResearch().catch(err => console.error('[Auto-Research Error]', err));
    
    // Process campaign immediately
    const resultString = await runProcessCampaign();
    console.log("[Emailer Cron] Local script response:", resultString);
  } catch (error) {
    console.error('[Emailer Cron] Unexpected error:', error);
  } finally {
    isRunning = false;
  }
}

export function startEmailerCron() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Emailer Cron] Missing Supabase credentials. Cron will not start.');
    return;
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[Emailer Cron] Initialized. Running every 1 minute (with auto-research).');
  
  setTimeout(() => {
    runEmailerCron();
    // Run every 1 minute (60 * 1000) for maximum throughput
    setInterval(runEmailerCron, 60 * 1000);
  }, 15 * 1000); // 15s initial delay
}
