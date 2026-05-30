const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('businesses').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Businesses:', data);
  }
}

main().catch(console.error);
