require('dotenv').config({ path: require('path').resolve(__dirname, 'companies/Relay/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeads() {
  console.log('Checking recent leads...');
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, company, email, research_status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching leads:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkLeads();
