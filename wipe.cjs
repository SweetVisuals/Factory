require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeEmails() {
    console.log("Wiping emails...");
    // Just delete all sent emails for now since it's testing
    const { error } = await supabase.from('inbox_emails').delete().eq('folder', 'sent');
    if (error) {
        console.error("Error wiping:", error);
    } else {
        console.log("Wiped all sent emails successfully.");
    }
}

wipeEmails();
