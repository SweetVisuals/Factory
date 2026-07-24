const { createClient } = require('@supabase/supabase-js');
const s = createClient('http://5.75.252.100:8000', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q');

async function cleanLeads() {
  console.log('Cleaning leads...');
  const { data, error } = await s
    .from('leads')
    .delete()
    .or('email.is.null,email.eq."",name.is.null,name.eq."",company.is.null,company.eq.""');
    
  if (error) console.error('Error:', error);
  else console.log('Cleaned leads without email, name, or company.', data);
}

cleanLeads();
