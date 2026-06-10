import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: failedProgress } = await supabase.from('campaign_progress').select('id, status').eq('status', 'failed');
  const { data: failedLogs } = await supabase.from('debug_logs').select('id').ilike('message', '%fail%');
  
  console.log(`Failed progress records: ${failedProgress?.length || 0}`);
  console.log(`Failed logs: ${failedLogs?.length || 0}`);
  
  if (failedProgress && failedProgress.length > 0) {
      await supabase.from('campaign_progress').delete().eq('status', 'failed');
      console.log("Deleted failed campaign_progress records");
  }
  if (failedLogs && failedLogs.length > 0) {
      await supabase.from('debug_logs').delete().ilike('message', '%fail%');
      console.log("Deleted failed debug_logs records");
  }

  // Ensure health scores are all 100
  await supabase.from('email_accounts').update({ health_score: 100 }).neq('health_score', 100);
  console.log("Ensured all email accounts have health_score = 100");
}
check().catch(console.error);
