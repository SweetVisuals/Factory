import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInbox() {
    console.log("Fetching inbox_emails...");

    const { data: emails, error } = await supabase
        .from('inbox_emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(10);

    if (error) {
        console.log("Error fetching emails:", error);
        return;
    }

    console.log("Found emails:", emails.length);
    emails.forEach(e => {
        console.log(`- Folder: ${e.folder}, Campaign: ${e.campaign_id}, From: ${e.from}, Subject: ${e.subject}`);
        console.log(`  body_text length: ${e.body_text ? e.body_text.length : 'NULL/Undefined'}`);
        console.log(`  body_html length: ${e.body_html ? e.body_html.length : 'NULL/Undefined'}`);
    });
}

testInbox();
