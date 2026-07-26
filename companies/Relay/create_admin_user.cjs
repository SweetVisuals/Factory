const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://db.relaysolutions.net';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@relaysolutions.net',
    password: 'ColdSpark123!',
    email_confirm: true
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('Admin user already exists!');
    } else {
      console.error('Error creating user:', error);
    }
  } else {
    console.log('Successfully created admin user:', data.user.id);
  }
}

run();
