import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Triggering process-campaign edge function...");
  const { data: triggerData, error: triggerErr } = await supabase.functions.invoke('process-campaign');
  console.log("[Emailer Cron] Edge function response:", triggerData);
  if (triggerErr) {
      console.error("[Emailer Cron] Edge function failed:", triggerErr);
  }
}

check();
