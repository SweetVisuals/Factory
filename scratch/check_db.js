require('dotenv').config({ path: 'c:/Users/Shadow/Desktop/Factory/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const campaignId = '8aae45ef-14a7-4699-be71-ce5ab44fb138';
  
  // Reset failed
  const { data, error } = await supabase.from('campaign_progress')
    .update({ status: 'pending' })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');
    
  console.log("Reset failed leads:", error || "Success");

  // Force schedule to be past due
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  await supabase.from('scheduled_emails')
    .update({ scheduled_for: pastDate, interval_minutes: 1 })
    .eq('campaign_id', campaignId);
    
  console.log("Set scheduled_for to past.");
}
run().catch(console.error);
