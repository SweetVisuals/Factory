const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

const parseEnv = (content) => {
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  return env;
};

const env = parseEnv(envContent);

const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
);

async function resume() {
  console.log('Resuming scraper for all accounts...');
  const { data, error } = await supabase
    .from('account_settings')
    .update({ is_scraping_active: true })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully set is_scraping_active = true');
  }
}

resume();
