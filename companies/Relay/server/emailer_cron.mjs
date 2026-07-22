import { createClient } from '@supabase/supabase-js';
import { runProcessCampaign } from './process_campaign_node.mjs';
import { researchAndSummarizeLead, AIRateLimitError } from './research_helper.mjs';

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
      .select('lead_id, campaigns!inner(id, status, pitch, objective), leads!inner(id, name, company, website, summary)')
      .in('campaigns.status', ['in_progress', 'email_only', 'active'])
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
        const campaignPitch = row.campaigns?.pitch || row.campaigns?.objective || '';
        console.log(`[Auto-Research] Researching ${company} (${lead.website})...`);
        const res = await researchAndSummarizeLead(lead, console.log, campaignPitch);
        if (res.summary) {
          await supabase
            .from('leads')
            .update({ 
              summary: res.summary,
              research_status: res.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', lead.id);
          console.log(`[Auto-Research] ✅ Saved research for ${company}`);
        }
      } catch (err) {
        if (err instanceof AIRateLimitError) {
          console.log(`[Auto-Research] Rate limit hit. Pausing auto-research cron for 60 seconds...`);
          await new Promise(r => setTimeout(r, 60000));
        } else {
          console.error(`[Auto-Research] ❌ Failed for ${lead.company || 'Unknown'}: ${err.message}`);
        }
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
    const { data: memData } = await supabase.from('agent_memory').select('value').eq('key_name', 'factory_status').maybeSingle();
    let hasAiCredits = true;
    if (memData?.value?.status === 'paused' && memData?.value?.reason === 'insufficient_credits') {
      console.log('[Emailer Cron] Factory is paused due to insufficient credits. Checking balance...');
      hasAiCredits = false;
      try {
         const deepseekKey = process.env.DEEPSEEK_API_KEY || 'sk-d703ac9c0fe74d05b1693c50a81ea9bc';
         const balRes = await fetch('https://api.deepseek.com/user/balance', { headers: { 'Authorization': `Bearer ${deepseekKey}` } });
         if (balRes.ok) {
            const balData = await balRes.json();
            if (balData && balData.balance_infos && balData.balance_infos.length > 0) {
               let realBalance = parseFloat(balData.balance_infos[0].total_balance);
               await supabase.from('agent_memory').upsert({ key_name: 'api_credits', value: { balance: realBalance } }, { onConflict: 'key_name' });
               if (realBalance > 0) {
                  console.log(`[Emailer Cron] Balance is now ${realBalance}. Auto-resuming factory!`);
                  await supabase.from('agent_memory').upsert({ key_name: 'factory_status', value: { status: 'running' } }, { onConflict: 'key_name' });
                  hasAiCredits = true;
               } else {
                  console.log(`[Emailer Cron] Balance is still ${realBalance}. Continuing non-AI tasks.`);
               }
            }
         }
      } catch (err) {
         console.error('[Emailer Cron] Error checking balance:', err);
      }
    } else if (memData?.value?.status === 'paused') {
      console.log(`[Emailer Cron] Factory is paused for reason: ${memData?.value?.reason}. Skipping.`);
      isRunning = false;
      return;
    }

    console.log('[Emailer Cron] Running campaign processing...');
    if (hasAiCredits) {
      // Trigger auto-research in background (decoupled)
      runAutoResearch().catch(err => console.error('[Auto-Research Error]', err));
    }
    
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
