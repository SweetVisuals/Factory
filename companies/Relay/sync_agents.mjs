import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const agentsToSync = [
  { name: 'Boss', filename: 'boss_agent.md' },
  { name: 'Market Researcher', filename: 'relay_market_researcher_agent.md' },
  { name: 'Scraper', filename: 'relay_scraper_agent.md' },
  { name: 'Validator', filename: 'relay_validator_agent.md' },
  { name: 'Sales Strategist', filename: 'relay_sales_strategist_agent.md' },
  { name: 'Emailer', filename: 'relay_emailer_agent.md' }
];

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData) {
    console.error("Authentication failed");
    return;
  }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const rootDir = path.resolve(__dirname, '../../');
  console.log("Root directory:", rootDir);

  for (const agent of agentsToSync) {
    const filePath = path.join(rootDir, agent.filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found!`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Update instructions in the DB
    const { error } = await client
      .from('agents')
      .update({ instructions: content })
      .eq('name', agent.name);

    if (error) {
      console.error(`Error updating agent ${agent.name}:`, error.message);
    } else {
      console.log(`Successfully updated ${agent.name} with content from ${agent.filename}`);
    }
  }
}

main().catch(console.error);
