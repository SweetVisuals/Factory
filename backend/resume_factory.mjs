import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resume() {
  const { error } = await supabase.from('agent_memory').update({
    value: { status: 'active' }
  }).eq('key_name', 'factory_status');
  
  if (error) {
    console.error('Error resuming factory:', error);
  } else {
    console.log('Factory engine successfully unpaused in Supabase!');
  }
}

resume();
