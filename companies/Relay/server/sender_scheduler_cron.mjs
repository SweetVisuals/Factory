import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runProcessCampaign } from './process_campaign_node.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_OPENCLAW_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_OPENCLAW_ANON_KEY;

export function startSenderSchedulerCron() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Sender Scheduler] Missing Supabase credentials. Cron will not start.');
    return;
  }

  async function runCronJob() {
    console.log('[Sender Scheduler] Triggering local process-campaign node script...');
    try {
      const resultString = await runProcessCampaign();
      console.log('[Sender Scheduler] Local script response:', resultString);
    } catch (err) {
      console.error('[Sender Scheduler] Unexpected error:', err);
    }
  }

  console.log('[Sender Scheduler] Initialized. Running every 5 minutes.');
  setTimeout(runCronJob, 20000); // 20s delay on boot
  setInterval(runCronJob, 5 * 60 * 1000); // 5 minutes
}
