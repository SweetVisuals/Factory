const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://db.relaysolutions.net';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) return console.error(listError);
  
  const user = users.users.find(u => u.email === 'admin@relaysolutions.net');
  if (!user) return console.error('User not found!');

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: 'ColdSpark123!',
    email_confirm: true
  });

  if (error) {
    console.error('Error updating user password:', error);
  } else {
    console.log('Successfully updated password for:', data.user.email);
  }
}

run();
