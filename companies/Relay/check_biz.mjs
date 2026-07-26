import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('businesses').select('*').limit(1);
  if (error) {
    console.error('Error fetching businesses:', error);
  } else {
    console.log('Columns in businesses:', Object.keys(data[0] || {}));
  }
}
check();
