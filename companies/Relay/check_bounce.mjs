import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    let output = "";
    
    // Check tables for bounce fields
    const tables = ['email_accounts', 'campaigns', 'leads', 'campaign_progress', 'scheduled_emails'];
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (data && data.length > 0) {
            output += `--- ${table} ---\n`;
            output += Object.keys(data[0]).join(', ') + '\n';
        }
    }
    
    console.log(output);
}
check().catch(console.error);
