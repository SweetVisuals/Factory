const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('agents').select('name');
  if (error) {
    console.error('Error fetching agents:', error);
  } else {
    console.log('Agents in database:', data);
  }
}

run();
