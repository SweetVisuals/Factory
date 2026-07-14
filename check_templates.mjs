import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('templates').select('id, name, subject, content').limit(5);
  if (error) console.error(error);
  console.log('Existing templates:');
  for (const t of (data || [])) {
    console.log(`\n--- ${t.name} ---`);
    console.log(`Subject: ${t.subject}`);
    console.log(`Content: ${t.content?.substring(0, 200)}...`);
  }
  
  // Count total
  const { count } = await supabase.from('templates').select('*', { count: 'exact', head: true });
  console.log(`\nTotal templates: ${count}`);
  
  // Check table columns
  const { data: sample } = await supabase.from('templates').select('*').limit(1);
  if (sample && sample[0]) {
    console.log('\nTemplate columns:', Object.keys(sample[0]));
  }
}

check();
