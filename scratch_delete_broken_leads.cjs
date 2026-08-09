const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const names = [
    'WAT  PHRATHATCHOHAE (SHEFFIELD, UK)',
    'WAT PHRATHATCHOHAE (SHEFFIELD, UK)',
    'THE APOSTOLIC CHURCH (LAWNA) READING, UK',
    'Foundations for Families & Their Communities',
    'COMMUNITIES & CLIMATE ACTION ALLIANCE LIMITED'
  ];

  for (const name of names) {
    console.log(`Searching for lead matching: "${name}"`);
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, email, phone')
      .ilike('name', `%${name.split(' (')[0]}%`); // Use substring to be safe

    if (error) {
      console.error('Search error for:', name, error);
      continue;
    }

    if (data && data.length > 0) {
      console.log(`Found ${data.length} matches:`, data);
      const ids = data.map(d => d.id);
      const { error: delError } = await supabase
        .from('leads')
        .delete()
        .in('id', ids);

      if (delError) {
        console.error('Delete error for IDs:', ids, delError);
      } else {
        console.log(`Successfully deleted matching leads with IDs:`, ids);
      }
    } else {
      console.log('No matching leads found for:', name);
    }
  }
}

run();
