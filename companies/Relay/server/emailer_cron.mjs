import { createClient } from '@supabase/supabase-js';

let supabase = null;

import { runProcessCampaign } from './process_campaign_node.mjs';

async function runEmailerCron() {
  console.log('[Emailer Cron] Triggering local process-campaign node script...');
  try {
    const resultString = await runProcessCampaign();
    console.log("[Emailer Cron] Local script response:", resultString);
  } catch (error) {
    console.error('[Emailer Cron] Unexpected error:', error);
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

  console.log('[Emailer Cron] Initialized. Running every 5 minutes.');
  
  setTimeout(() => {
    runEmailerCron();
    // Run every 5 minutes (5 * 60 * 1000)
    setInterval(runEmailerCron, 5 * 60 * 1000);
  }, 30 * 1000); // 30s initial delay
}
