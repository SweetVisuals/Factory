const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching leads with special symbols in phone numbers...');
  
  // We'll fetch in batches to avoid memory overload
  let hasMore = true;
  let offset = 0;
  const limit = 100;
  let updatedCount = 0;

  while (hasMore) {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, phone')
      .like('phone', '%%')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching batch:', error);
      break;
    }

    if (!leads || leads.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${leads.length} leads...`);

    for (const lead of leads) {
      const cleaned = lead.phone.replace(/[\n\r\t]/g, '').trim();
      const { error: updateError } = await supabase
        .from('leads')
        .update({ phone: cleaned })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`Error updating lead ${lead.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    offset += limit;
  }

  console.log(`Finished cleaning database phone numbers. Total updated: ${updatedCount}`);
}

run();
