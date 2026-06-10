import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Deleting campaign "Custom Automation Systems — Discovery Calls"...');
  
  // Find campaign
  const { data: campaignData } = await supabase
    .from('campaigns')
    .select('id')
    .eq('name', 'Custom Automation Systems — Discovery Calls')
    .maybeSingle();
    
  if (campaignData) {
    // Delete campaign (cascade deletes from progress/leads usually handled by DB, or we just delete it)
    const { error: delError } = await supabase.from('campaigns').delete().eq('id', campaignData.id);
    if (delError) console.error('Error deleting campaign:', delError.message);
    else console.log('Deleted campaign successfully.');
  } else {
    console.log('Campaign not found or already deleted.');
  }

  console.log('Clearing failed/bounced progress logs...');
  const { error: progError } = await supabase.from('campaign_progress').delete().eq('status', 'failed');
  if (progError) console.error('Error clearing progress:', progError.message);
  else console.log('Cleared campaign_progress failures.');

  console.log('Clearing debug logs for bounces/errors...');
  const { error: logError } = await supabase.from('debug_logs').delete().eq('level', 'error');
  if (logError) console.error('Error clearing debug logs:', logError.message);
  else console.log('Cleared debug logs.');

  console.log('Resetting health scores to 100...');
  const { error: healthError } = await supabase.from('email_accounts').update({ health_score: 100, consecutive_bounces: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (healthError) console.error('Error resetting health score:', healthError.message);
  else console.log('Reset health scores to 100.');
  
  console.log('Done.');
}

main().catch(console.error);
