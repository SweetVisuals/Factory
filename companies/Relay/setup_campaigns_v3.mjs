import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Use the service role key if available, or authenticate
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('Connecting with service role available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // First authenticate
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  
  if (authError) {
    console.log('Auth error:', authError.message);
    // Try to proceed with the service role key anyway (it bypasses RLS)
    console.log('Trying with service key...');
    const serviceClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey, {
      db: { schema: 'public' }
    });
    
    const campaigns = [
      { name: 'Roofing Contractors - US', status: 'Draft' },
      { name: 'Legal Services - UK', status: 'Draft' },
      { name: 'Cybersecurity Compliance', status: 'Draft' },
      { name: 'E-commerce Stores', status: 'Draft' },
      { name: 'Real Estate Agents', status: 'Draft' }
    ];
    
    for (const c of campaigns) {
      const { data, error } = await serviceClient.from('campaigns').insert(c).select();
      if (error) console.log(`ERROR "${c.name}":`, error.message);
      else console.log(`OK "${c.name}":`, data[0].id);
    }
    return;
  }
  
  console.log('Authenticated as:', authData.user?.email);
  const user = authData.user;
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });
  
  // Get user from session
  const userId = user.id;
  
  const campaigns = [
    { user_id: userId, name: 'Roofing Contractors - US', status: 'Draft' },
    { user_id: userId, name: 'Legal Services - UK', status: 'Draft' },
    { user_id: userId, name: 'Cybersecurity Compliance', status: 'Draft' },
    { user_id: userId, name: 'E-commerce Stores', status: 'Draft' },
    { user_id: userId, name: 'Real Estate Agents', status: 'Draft' }
  ];
  
  for (const c of campaigns) {
    const { data, error } = await client.from('campaigns').insert(c).select();
    if (error) console.log(`ERROR "${c.name}":`, error.message);
    else console.log(`OK "${c.name}":`, data[0].id);
  }
  
  // List all campaigns
  const { data: all } = await client.from('campaigns').select('*');
  if (all) {
    console.log(`\nTotal campaigns: ${all.length}`);
    all.forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.status} | user: ${c.user_id}`));
  }
}

main().catch(console.error);
