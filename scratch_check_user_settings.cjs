const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('account_settings')
    .select('*')
    .eq('user_id', 'bc3210f9-f8fd-4732-972b-f49cea68d3c1')
    .maybeSingle();

  if (error) {
    console.error('Error fetching settings:', error);
  } else {
    console.log('Account settings for user bc3210f9-f8fd-4732-972b-f49cea68d3c1:', data);
  }
}

run();
