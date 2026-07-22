import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Get all campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, user_id');
    
  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    return;
  }
  
  console.log(`Found ${campaigns.length} campaigns:`);
  
  for (const campaign of campaigns) {
    // Count leads for this campaign
    // campaign_leads table maps campaign_id to lead_id or contains campaign_id. Let's find out how it references campaigns.
    const { count, error: countError } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    if (countError) {
      console.error(`Error counting leads for campaign ${campaign.id}:`, countError);
      continue;
    }
    
    console.log(`Campaign: "${campaign.name}" | ID: ${campaign.id} | Status: ${campaign.status} | Lead Count: ${count} | User ID: ${campaign.user_id}`);
  }
}

run().catch(console.error);
