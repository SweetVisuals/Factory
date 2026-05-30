import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentEmails() {
    console.log("Fetching recent inbox_emails...");

    const { data: emails, error } = await supabase
        .from('inbox_emails')
        .select('id, folder, from, to, subject, received_at, campaign_id')
        .ilike('to', '%kat@relaysolutions.net%')
        .order('received_at', { ascending: false })
        .limit(10);

    if (error) {
        console.log("Error:", error);
        return;
    }

    console.log(`Found ${emails.length} recent emails to kat:`);
    emails.forEach(e => {
        console.log(`- [${e.received_at}] Folder: ${e.folder}, Campaign: ${e.campaign_id}, From: ${e.from}, Subject: ${e.subject}`);
    });
}

checkRecentEmails();
