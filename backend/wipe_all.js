const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function wipeAll() {
    console.log("Wiping all tasks from the database to start from scratch...");
    
    // Delete all tasks
    const { error: err1 } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err1) console.error("Error wiping tasks:", err1);
    else console.log("Tasks wiped successfully.");
    
    // Optionally wipe chat_logs if we want a TRULY fresh start
    const { error: err2 } = await supabase.from('chat_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err2) console.error("Error wiping chat_logs:", err2);
    else console.log("Chat logs wiped successfully.");

    console.log("System is fully reset. The Boss will begin a fresh timeline on the next tick.");
}

wipeAll().catch(console.error);
