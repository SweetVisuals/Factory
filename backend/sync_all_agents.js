const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const AGENTS_TO_SYNC = [
  { name: 'Boss', file: '../boss_agent.md' },
  { name: 'Market Researcher', file: '../relay_market_researcher_agent.md' },
  { name: 'Scraper', file: '../relay_scraper_agent.md' },
  { name: 'Validator', file: '../relay_validator_agent.md' },
  { name: 'Sales Strategist', file: '../relay_sales_strategist_agent.md' },
  { name: 'Emailer', file: '../relay_emailer_agent.md' }
];

async function main() {
  console.log('Initializing Supabase client...');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  console.log('Authenticating manager session...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });

  if (authErr) {
    console.error('Authentication failed:', authErr.message);
    process.exit(1);
  }

  console.log('Authentication successful. Session token acquired.');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  for (const agent of AGENTS_TO_SYNC) {
    const filePath = path.join(__dirname, agent.file);
    console.log(`Reading local instructions from ${agent.file}...`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      continue;
    }

    const instructions = fs.readFileSync(filePath, 'utf-8');
    console.log(`Syncing agent "${agent.name}" (${instructions.length} bytes)...`);

    const { data, error } = await client
      .from('agents')
      .update({ instructions })
      .eq('name', agent.name)
      .select('id, name');

    if (error) {
      console.error(`Failed to sync agent "${agent.name}":`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Successfully synced agent "${agent.name}" to database.`);
    } else {
      console.warn(`No database records matched agent name "${agent.name}".`);
    }
  }

  console.log('Synchronization complete.');
}

main().catch(console.error);
