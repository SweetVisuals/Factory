require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://db.relaysolutions.net',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q' // service role key from .env
);

async function linkData() {
  const oldUserId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
  const newUserId = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1'; // The one we just created
  
  console.log('Old User ID:', oldUserId);
  console.log('New User ID:', newUserId);

  // Update tables
  const tables = ['campaigns', 'leads', 'email_accounts', 'email_threads', 'email_campaigns'];
  
  for (const table of tables) {
    console.log(`Updating ${table}...`);
    const { error: updateError } = await supabase
      .from(table)
      .update({ user_id: newUserId })
      .eq('user_id', oldUserId);
      
    if (updateError) {
      console.error(`Error updating ${table}:`, updateError.message);
    } else {
      console.log(`Successfully updated ${table}`);
    }
  }
}

linkData();
