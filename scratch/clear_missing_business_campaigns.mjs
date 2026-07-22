import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, business_id');
    
  if (error) {
    console.error('Error fetching campaigns:', error);
    return;
  }
  
  for (const campaign of campaigns) {
    if (!campaign.business_id) {
      console.log(`Campaign "${campaign.name}" has no business assigned. Clearing templates and schedules...`);
      
      // Delete schedules
      await supabase
        .from('scheduled_emails')
        .delete()
        .eq('campaign_id', campaign.id);
        
      // Delete templates
      await supabase
        .from('templates')
        .delete()
        .eq('campaign_id', campaign.id);
        
      // Reset status to paused
      await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign.id);
        
      console.log(`✅ Campaign "${campaign.name}" cleared and reset to paused.`);
    }
  }
}

run().catch(console.error);
