import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllLeads() {
    const { data: leads, error } = await supabase
        .from('leads')
        .select('email, company')
        .limit(20);

    if (error) {
        console.log("Error:", error);
        return;
    }

    console.log("Sample leads in DB:");
    leads.forEach(l => console.log(`- ${l.email} (${l.company})`));
}

checkAllLeads();
