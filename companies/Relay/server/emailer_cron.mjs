import { createClient } from '@supabase/supabase-js';
import { runProcessCampaign } from './process_campaign_node.mjs';
import { researchAndSummarizeLead, AIRateLimitError } from './research_helper.mjs';

let supabase = null;
let isRunning = false;

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
         const deepseekKey = process.env.DEEPSEEK_API_KEY;
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

  console.log('[Emailer Cron] Initialized. Running every 1 minute.');
  
  setTimeout(() => {
    runEmailerCron();
    // Run every 1 minute (60 * 1000) for maximum throughput
    setInterval(runEmailerCron, 60 * 1000);
  }, 15 * 1000); // 15s initial delay
}
