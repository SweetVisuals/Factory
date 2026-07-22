import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, name, status');
  
  for (const campaign of campaigns) {
    const { count, error } = await supabase
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    const { count: pausedCount } = await supabase
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'paused');
      
    const { count: scheduledCount } = await supabase
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'scheduled');

    console.log(`Campaign: "${campaign.name}" | Total schedules: ${count} | Paused: ${pausedCount} | Scheduled: ${scheduledCount}`);
  }
}

run().catch(console.error);
