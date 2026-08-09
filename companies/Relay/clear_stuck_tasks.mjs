import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function clearTasks() {
    const { data, error } = await supabaseAdmin
        .from('tasks')
        .update({ status: 'failed' })
        .eq('assigned_to', 'Scraper')
        .in('status', ['in_progress', 'pending', 'waiting']);
    
    if (error) {
        console.error("Error clearing tasks:", error);
    } else {
        console.log("Successfully cleared stuck background tasks.");
    }
}
clearTasks();
