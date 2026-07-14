import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0NTg0OCwiZXhwIjoyMDk0MDIxODQ4fQ.s-ucJhIu80K2JPWBmWw7ZBkIS4P0rYd1I7KuhQXfm4U';
const supabase = createClient(url, key);

async function run() {
    console.log('Fetching all leads for backup...');
    let allLeads = [];
    let start = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase.from('leads').select('*').range(start, start + limit - 1);
        if (error) {
            console.error('Error fetching leads:', error);
            process.exit(1);
        }
        if (!data || data.length === 0) break;
        allLeads = allLeads.concat(data);
        console.log(`Fetched ${allLeads.length} leads...`);
        start += limit;
    }

    fs.writeFileSync('leads_backup_OLD_Leads.json', JSON.stringify(allLeads, null, 2));
    console.log('Backup saved to leads_backup_OLD_Leads.json. Now deleting leads...');

    // Delete in batches to avoid timeout
    for (let i = 0; i < allLeads.length; i += limit) {
        const batchIds = allLeads.slice(i, i + limit).map(l => l.id);
        const { error: delError } = await supabase.from('leads').delete().in('id', batchIds);
        if (delError) {
            console.error('Error deleting batch:', delError);
        } else {
            console.log(`Deleted batch ${i} to ${i + batchIds.length}`);
        }
    }
    console.log('Leads table reset complete.');
}
run();
