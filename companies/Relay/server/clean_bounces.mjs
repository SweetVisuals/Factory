import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanBounces() {
    console.log("Deleting bounced emails...");

    const { error, count } = await supabase
        .from('inbox_emails')
        .delete({ count: 'exact' })
        .ilike('from', '%mailer-daemon%');

    if (error) {
        console.log("Error:", error);
        return;
    }

    console.log(`Deleted ${count} bounced emails.`);
}

cleanBounces();
