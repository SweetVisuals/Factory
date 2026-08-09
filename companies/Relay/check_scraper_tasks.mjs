import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTasks() {
    const { data, error } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('assigned_to', 'Scraper')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Recent Scraper Tasks:");
        console.table(data);
    }
}
checkTasks();
