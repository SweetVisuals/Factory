import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`;
  const response = await fetch(url);
  const json = await response.json();
  const def = json.definitions.campaign_stats;
  console.log(JSON.stringify(def, null, 2));
}

check();
