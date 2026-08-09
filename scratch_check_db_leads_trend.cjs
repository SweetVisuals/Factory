const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true });
    
  console.log('Total leads in database:', totalLeads);

  const { data: activeTasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', 'Scraper')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (taskErr) {
    console.error('Error fetching scraper tasks:', taskErr);
  } else {
    console.log('Recent scraper tasks:', activeTasks);
  }
}

run();
