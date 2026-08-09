const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profileCols, error: pError } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles columns:', Object.keys(profileCols?.[0] || {}));
  
  const { data: settingsCols, error: sError } = await supabase.from('account_settings').select('*').limit(1);
  console.log('account_settings columns:', Object.keys(settingsCols?.[0] || {}));
}

run();
