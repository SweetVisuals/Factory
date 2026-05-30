const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const agentFiles = {
  'Boss': 'boss_agent.md',
  'Market Researcher': 'relay_market_researcher_agent.md',
  'Scraper': 'relay_scraper_agent.md',
  'Validator': 'relay_validator_agent.md',
  'Sales Strategist': 'relay_sales_strategist_agent.md',
  'Emailer': 'relay_emailer_agent.md',
  'Design Team': 'design_team_agent.md',
  'Manager': 'manager_agent.md',
  'Marketing': 'marketing_team_agent.md',
  'Product Specialist': 'product_specialist_agent.md',
  'Specialist': 'specialist_agent.md',
  'Account Manager': 'scheduler_account_manager_agent.md',
  'Content Creator': 'scheduler_content_creator_agent.md',
  'Scheduler Manager': 'scheduler_manager_agent.md',
  'Pinterest Curator': 'scheduler_pinterest_curator_agent.md'
};

async function syncAll() {
  console.log('Starting sync of agent instructions...');
  for (const [agentName, filename] of Object.entries(agentFiles)) {
    const filePath = path.join(__dirname, '..', filename);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found, skipping: ${filename}`);
      continue;
    }
    
    const instructions = fs.readFileSync(filePath, 'utf-8');
    const { error } = await supabase
      .from('agents')
      .update({ instructions })
      .eq('name', agentName);
      
    if (error) {
      console.error(`Error syncing instructions for ${agentName}:`, error.message);
    } else {
      console.log(`Successfully synced ${agentName} instructions.`);
    }
  }
  console.log('Sync complete.');
}

syncAll();
