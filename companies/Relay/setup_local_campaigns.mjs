import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Setting up new local business campaigns...');
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (authError) {
      console.error('Auth Error:', authError.message);
      return;
  }
  const user_id = authData.user.id;

  const { data: business } = await supabase.from('businesses').select('id, user_id').eq('name', 'Relay Solutions').single();
  const business_id = business ? business.id : '102a3bca-7b0a-4cee-bd33-fefd7b4450b4';

  const newCampaigns = [
    { name: 'HVAC & Plumbing Services', status: 'Draft', business_id, user_id, niche: 'HVAC and plumbing services' },
    { name: 'Local Property Management', status: 'Draft', business_id, user_id, niche: 'property management' },
    { name: 'Commercial Cleaning Services', status: 'Draft', business_id, user_id, niche: 'commercial cleaning services' },
    { name: 'Specialized Local Manufacturing', status: 'Draft', business_id, user_id, niche: 'specialized manufacturing' },
    { name: 'Dental Clinics', status: 'Draft', business_id, user_id, niche: 'dental clinics orthodontists' }
  ];

  for (const c of newCampaigns) {
    const { data, error } = await supabase.from('campaigns').insert(c).select();
    if (error) console.log(`ERROR creating "${c.name}":`, error.message);
    else console.log(`OK created "${c.name}" with ID: ${data[0].id}`);
  }
}

main().catch(console.error);
