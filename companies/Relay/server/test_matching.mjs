import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMatch() {
    // Try with a known lead email or just test the query structure
    console.log("Testing query structure...");

    // We don't know an exact email, so let's just fetch any campaign lead
    const { data: AnyLead } = await supabase
        .from('campaign_leads')
        .select('leads ( email )')
        .limit(1);

    if (!AnyLead || AnyLead.length === 0) {
        console.log("No leads found in campaign_leads.");
        return;
    }

    const testEmail = AnyLead[0].leads.email;
    console.log("Testing with email:", testEmail);

    const start = Date.now();
    try {
        const { data: leadMatch, error } = await supabase
            .from('leads')
            .select('id, campaign_leads!inner(campaign_id)')
            .eq('email', testEmail)
            .limit(1)
            .maybeSingle();

        console.log("Result:", JSON.stringify(leadMatch, null, 2));
        console.log("Error:", error);
    } catch (e) {
        console.log("Exception:", e);
    }
    console.log("Time (ms):", Date.now() - start);
}

testMatch();
