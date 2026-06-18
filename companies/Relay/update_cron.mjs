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
    console.log('Updating cron...');
    const sql = `
        select cron.unschedule('process-campaign-every-minute');
    `;
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    if (error) console.error('Error disabling cron:', error.message);
    else console.log('Successfully disabled redundant pg_cron.', data);
}

main().catch(console.error);
