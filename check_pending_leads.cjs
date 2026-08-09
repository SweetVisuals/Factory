require('dotenv').config({ path: require('path').resolve(__dirname, 'companies/Relay/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPending() {
  console.log('Checking for leads that need research...');
  
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, research_status, research_attempts')
    .or('research_status.is.null,research_status.neq.completed')
    .lte('research_attempts', 2);
    
  if (leadsError) {
    console.error('Error:', leadsError);
    return;
  }
  
  console.log(`Found ${leads.length} leads pending research.`);
  
  const { data: failedLeads } = await supabase
    .from('leads')
    .select('id, research_status, research_attempts')
    .or('research_status.is.null,research_status.neq.completed')
    .gt('research_attempts', 2);
    
  console.log(`Found ${failedLeads ? failedLeads.length : 0} leads that failed (attempts > 2).`);
}

checkPending();
