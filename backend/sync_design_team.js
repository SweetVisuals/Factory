require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const instrPath = path.join(__dirname, '../design_team_agent.md');
const instr = fs.readFileSync(instrPath, 'utf-8');

async function sync() {
  const { error } = await supabase.from('agents').update({ instructions: instr }).eq('name', 'Design Team');
  if (error) console.error('Error syncing:', error);
  else console.log('Successfully synced Design Team instructions to DB.');
}

sync();
