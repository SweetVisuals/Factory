import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

let supabaseUrl = '';
let supabaseKey = ''; // Using the Anon key for now, hoping RLS allows it, or we use service role

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching businesses...');
  const { data: businesses, error: fetchErr } = await supabase.from('businesses').select('*');
  
  if (fetchErr) {
    console.error('Error fetching businesses:', fetchErr);
    // If it fails, we might need a SQL migration. Let's try RPC if standard update fails.
  }

  if (businesses) {
    for (const b of businesses) {
      let color = '#3b82f6'; // default blue
      if (b.name.toLowerCase().includes('relay')) color = '#10b981'; // green
      if (b.name.toLowerCase().includes('mrmedic')) color = '#3b82f6'; // blue
      
      console.log(`Setting ${b.name} to ${color}`);
      
      // Try to update. If theme_color doesn't exist, this will fail.
      const { error: updateErr } = await supabase.from('businesses').update({ theme_color: color }).eq('id', b.id);
      
      if (updateErr) {
        console.error(`Failed to update ${b.name}:`, updateErr.message);
        if (updateErr.message.includes('column "theme_color" of relation "businesses" does not exist')) {
          console.log('Column does not exist. We need to run a DDL migration via SQL.');
          // We can't run DDL via REST API. We must ask the user or write a SQL file.
        }
      } else {
        console.log(`Successfully updated ${b.name}`);
      }
    }
  }
}

run();
