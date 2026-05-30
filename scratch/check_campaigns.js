const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkCampaigns() {
  const { data: camps, error } = await supabase
    .from('campaigns')
    .select('id, name, niche, objective, status');

  if (error) {
    console.error('Error fetching campaigns:', error.message);
    return;
  }

  console.log('Current Campaigns in Database:');
  camps.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.id}] Name: "${c.name}" | Niche: "${c.niche}" | Objective: "${c.objective}" | Status: "${c.status}"`);
  });
}

checkCampaigns();
