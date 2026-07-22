import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const campaignsToRevert = [
    { name: "Creative Agencies IN LONDON", originalStatus: "paused" },
    { name: "Creative Agencies (UK)", originalStatus: "paused" },
    { name: "Web / Tech Ad Agencies (London)", originalStatus: "in_progress" },
    { name: "UK Builders & Contractors Outreach", originalStatus: "paused" },
    { name: "UK Landscapers & Groundworkers Outreach", originalStatus: "paused" },
    { name: "UK Roofing Contractors Outreach", originalStatus: "paused" }
  ];

  console.log('Reverting campaigns back to original statuses...');
  
  for (const item of campaignsToRevert) {
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: item.originalStatus })
      .eq('name', item.name)
      .select();
      
    if (error) {
      console.error(`Failed to revert campaign "${item.name}":`, error);
    } else if (data && data.length > 0) {
      console.log(`Reverted "${item.name}" back to "${item.originalStatus}".`);
    } else {
      console.log(`Campaign "${item.name}" not found to revert.`);
    }
  }

  console.log('\nChecking if any campaigns with > 1000 leads have generated sequences (scheduled_emails)...');
  
  const { data: campaigns, error: campError } = await supabase
    .from('campaigns')
    .select('id, name, status');
    
  if (campError) {
    console.error('Error fetching campaigns:', campError);
    return;
  }
  
  let markedCount = 0;

  for (const campaign of campaigns) {
    const { count: leadCount } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    const { count: scheduleCount } = await supabase
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    console.log(`Campaign: "${campaign.name}" | Lead Count: ${leadCount} | Schedule Count: ${scheduleCount} | Current Status: ${campaign.status}`);
    
    if (leadCount > 1000 && scheduleCount > 0) {
      console.log(`-> Marking "${campaign.name}" as "review" because it has ${leadCount} leads and ${scheduleCount} schedules.`);
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ status: 'review' })
        .eq('id', campaign.id);
        
      if (updateError) {
        console.error(`Failed to mark campaign "${campaign.name}" for review:`, updateError);
      } else {
        markedCount++;
      }
    }
  }
  
  console.log(`\nOperation finished. Marked ${markedCount} campaigns for review.`);
}

run().catch(console.error);
