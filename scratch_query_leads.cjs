const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q'; // service role

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: cols, error: colError } = await supabase.from('leads').select('*').limit(1);
  if (colError) {
    console.error('Error fetching leads metadata:', colError);
    return;
  }
  console.log('Columns in leads table:', Object.keys(cols[0] || {}));

  const { data: countData, error: countError } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .not('phone', 'is', null)
    .neq('phone', '');
  
  if (countError) {
    console.error('Error counting phone leads:', countError);
  } else {
    console.log('Number of leads with non-empty phone:', countData ? countData.length : 0);
  }

  const { data: sample, error: sampleError } = await supabase
    .from('leads')
    .select('id, name, email, phone, location')
    .not('phone', 'is', null)
    .neq('phone', '')
    .limit(5);

  if (sampleError) {
     console.error('Error sample:', sampleError);
  } else {
     console.log('Sample phone leads:', sample);
  }
}

run();
