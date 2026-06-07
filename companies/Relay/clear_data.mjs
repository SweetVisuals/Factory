import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  console.log('Starting data wipe...');

  // Arrays of tables to clear in order of dependencies (child tables first)
  const tables = [
    'campaign_emails',
    'campaigns_leads',
    'lead_campaigns',
    'lists_leads',
    'campaigns',
    'lists',
    'leads'
  ];

  for (const table of tables) {
    console.log(`Clearing ${table}...`);
    // Supabase delete requires a filter. ne (not equal) a non-existent id or simply use a trick:
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`Error clearing ${table}:`, error.message);
    } else {
      console.log(`Successfully cleared ${table}.`);
    }
  }

  console.log('Data wipe complete.');
}

clearData().catch(console.error);
