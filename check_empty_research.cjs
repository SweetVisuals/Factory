const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://db.relaysolutions.net',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q'
);

async function countEmptyResearch() {
  console.log('Counting leads with missing research data...');
  
  // To avoid timeouts, we can query in batches, or we can use the head/count feature of Supabase
  const { count, error } = await s
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .or('pain_points.eq.[],pain_points.is.null')
    .or('growth_signals.eq.[],growth_signals.is.null')
    .or('recent_news.eq.[],recent_news.is.null');
    
  if (error) {
    console.error('Error counting leads:', error);
  } else {
    console.log(`Found ${count} leads with no pain points, no growth signals, and no recent news.`);
  }
}

countEmptyResearch();
