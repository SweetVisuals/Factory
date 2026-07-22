import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Fetching all campaigns...');
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, user_id');
    
  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    return;
  }
  
  console.log(`Checking lead counts for ${campaigns.length} campaigns...`);
  
  const campaignsToUpdate = [];
  
  for (const campaign of campaigns) {
    const { count, error: countError } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    if (countError) {
      console.error(`Error counting leads for campaign ${campaign.id}:`, countError);
      continue;
    }
    
    console.log(`Campaign: "${campaign.name}" | ID: ${campaign.id} | Lead Count: ${count} | Current Status: ${campaign.status}`);
    
    if (count > 1000) {
      campaignsToUpdate.push({
        id: campaign.id,
        name: campaign.name,
        oldCount: count,
        oldStatus: campaign.status
      });
    }
  }
  
  if (campaignsToUpdate.length === 0) {
    console.log('No campaigns found with over 1000 leads.');
    return;
  }
  
  console.log(`\nMarking ${campaignsToUpdate.length} campaigns for review...`);
  
  for (const item of campaignsToUpdate) {
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'review' })
      .eq('id', item.id)
      .select();
      
    if (error) {
      console.error(`Failed to update campaign "${item.name}":`, error);
    } else {
      console.log(`Successfully updated campaign "${item.name}" (ID: ${item.id}) from "${item.oldStatus}" to "review".`);
    }
  }
  
  console.log('\nVerification check:');
  const { data: updatedCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status');
    
  for (const c of updatedCampaigns) {
    console.log(`Campaign: "${c.name}" | Status: ${c.status}`);
  }
}

run().catch(console.error);
