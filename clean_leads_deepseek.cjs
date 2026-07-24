require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://db.relaysolutions.net',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q'
);

async function cleanLeads() {
  console.log('Fetching leads to analyze...');
  const { data: leads, error } = await supabase.from('leads').select('id, summary');
  
  if (error) {
    console.error('Error fetching leads:', error.message);
    return;
  }
  
  console.log(`Found ${leads.length} total leads.`);
  
  let toDelete = [];
  
  for (const lead of leads) {
    if (lead.summary && lead.summary.includes('## ⚡ Personalised Detail\nwork')) {
        toDelete.push(lead.id);
    }
  }
  
  console.log(`Found ${toDelete.length} leads where personalised detail says 'work'. Deleting...`);
  
  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error: delError } = await supabase.from('leads').delete().in('id', chunk);
      if (delError) {
        console.error('Error deleting batch:', delError.message);
      }
    }
    console.log('Successfully deleted the bad leads.');
  } else {
    console.log('No bad leads found.');
  }
}

cleanLeads();
