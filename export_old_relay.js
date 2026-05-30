const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const OLD_URL = 'https://wmoyigdovtpuayjxezzc.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const oldSupabase = createClient(OLD_URL, OLD_KEY);

async function exportData() {
    console.log('Fetching data from old Supabase...');
    const tables = [
        'campaigns', 
        'leads', 
        'campaign_leads', 
        'email_accounts', 
        'email_warmup_progress',
        'campaign_sequences'
    ];
    
    const data = {};
    
    for (const table of tables) {
        console.log(`Exporting ${table}...`);
        const { data: rows, error } = await oldSupabase.from(table).select('*');
        if (error) {
            console.error(`Error exporting ${table}:`, error.message);
            data[table] = [];
        } else {
            data[table] = rows;
            console.log(`Exported ${rows.length} rows from ${table}`);
        }
    }
    
    fs.writeFileSync('relay_migration_data.json', JSON.stringify(data, null, 2));
    console.log('Export complete! Data saved to relay_migration_data.json');
}

exportData();
