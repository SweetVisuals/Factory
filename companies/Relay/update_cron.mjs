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
        select cron.schedule('process-campaign-every-minute', '* * * * *', $$
            select net.http_post(
                url:='https://fzcrjogrnujrfxafxbkh.supabase.co/functions/v1/process-campaign',
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0NTg0OCwiZXhwIjoyMDk0MDIxODQ4fQ.s-ucJhIu80K2JPWBmWw7ZBkIS4P0rYd1I7KuhQXfm4U"}'::jsonb,
                body:='{}'::jsonb
            ) as request_id;
        $$);
    `;
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    if (error) console.error('Error updating cron:', error.message);
    else console.log('Successfully updated cron to run every minute.', data);
}

main().catch(console.error);
