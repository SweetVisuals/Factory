import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLead() {
    const email = 'acedkmgmt@gmail.com';

    console.log(`Searching for lead: ${email}`);

    const { data: leads, error } = await supabase
        .from('leads')
        .select('id, email, campaign_leads ( campaign_id )')
        .ilike('email', email);

    if (error) {
        console.log("Error:", error);
        return;
    }

    console.log("Found leads:", JSON.stringify(leads, null, 2));
}

testLead();
