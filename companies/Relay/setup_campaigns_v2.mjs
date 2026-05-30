import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const userId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
  
  // Get actual schema from information_schema
  const { data: cols, error: ce } = await supabase.rpc('exec_sql', {
    sql_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaigns' AND table_schema = 'public'"
  }).then(r => r).catch(e => ({ error: e }));
  
  // Try getting column info via the API directly
  const { data: test } = await supabase.from('campaigns').select('*').limit(1);
  
  if (test && test.length > 0) {
    console.log('Existing columns:', Object.keys(test[0]).join(', '));
  }
  
  // Try accessing campaigns with just minimal fields now that RLS is off
  console.log('\nCreating campaigns...');
  
  const campaigns = [
    {
      user_id: userId,
      name: 'Roofing Contractors - US',
      status: 'Draft',
      schedule: { frequency: 'daily', maxEmailsPerDay: 100 }
    },
    {
      user_id: userId,
      name: 'Legal Services - UK',
      status: 'Draft',
      schedule: { frequency: 'daily', maxEmailsPerDay: 100 }
    },
    {
      user_id: userId,
      name: 'Cybersecurity Compliance',
      status: 'Draft',
      schedule: { frequency: 'daily', maxEmailsPerDay: 100 }
    },
    {
      user_id: userId,
      name: 'E-commerce Stores',
      status: 'Draft',
      schedule: { frequency: 'daily', maxEmailsPerDay: 100 }
    },
    {
      user_id: userId,
      name: 'Real Estate Agents',
      status: 'Draft',
      schedule: { frequency: 'daily', maxEmailsPerDay: 100 }
    }
  ];

  for (const c of campaigns) {
    const { data, error } = await supabase.from('campaigns').insert(c).select();
    if (error) console.log(`ERROR "${c.name}":`, error.message);
    else console.log(`OK "${c.name}":`, data[0].id);
  }
  
  // List all campaigns now
  const { data: all } = await supabase.from('campaigns').select('*');
  if (all) {
    console.log(`\nTotal campaigns: ${all.length}`);
    all.forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.status}`));
  }
}

main().catch(console.error);
