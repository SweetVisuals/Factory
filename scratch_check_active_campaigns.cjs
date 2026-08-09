const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status, niche, user_id');
    
  if (error) {
     console.error('Error campaigns:', error);
     return;
  }
  
  console.log('Campaigns count:', campaigns.length);
  console.log('Campaigns list:', campaigns);
  
  for (const c of campaigns) {
     const { count } = await supabase
       .from('campaign_leads')
       .select('*', { count: 'exact', head: true })
       .eq('campaign_id', c.id);
       
     console.log(`Campaign "${c.name}" (ID: ${c.id}) has ${count} leads.`);
  }
}

run();
