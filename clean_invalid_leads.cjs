const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://db.relaysolutions.net',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q'
);

async function cleanInvalidLeads() {
  console.log('Cleaning leads with validation_status = "invalid" in batches...');
  
  let totalDeleted = 0;
  let batchSize = 50; // Reduced batch size to avoid 414 Request-URI Too Large
  
  while (true) {
    const { data, error } = await s
      .from('leads')
      .select('id')
      .eq('validation_status', 'invalid')
      .limit(batchSize);
      
    if (error) {
      console.error('Error fetching batch:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      console.log('No more invalid leads found.');
      break;
    }
    
    const ids = data.map(d => d.id);
    console.log(`Deleting batch of ${ids.length} invalid leads...`);
    
    const { error: delError } = await s
      .from('leads')
      .delete()
      .in('id', ids);
      
    if (delError) {
      console.error('Error deleting batch:', delError);
      break;
    }
    
    totalDeleted += ids.length;
    console.log(`Deleted ${totalDeleted} so far.`);
    
    if (ids.length < batchSize) {
      break;
    }
  }
  
  console.log(`Finished! Total deleted: ${totalDeleted}`);
}

cleanInvalidLeads();
