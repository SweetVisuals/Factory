import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: campaigns } = await supabase.from('campaigns').select('id').limit(1);
    if (!campaigns || campaigns.length === 0) {
        console.log("No campaigns found");
        return;
    }
    const campaignId = campaigns[0].id;
    console.log("Testing with campaignId:", campaignId);

    const { data: campaignLeads, error } = await supabase
        .from('campaign_leads')
        .select('leads(id, email)')
        .eq('campaign_id', campaignId)
        .limit(3);

    console.log("campaignLeads:", JSON.stringify(campaignLeads, null, 2));
    console.log("error:", error);

    const { data: progress } = await supabase
        .from('campaign_progress')
        .select('lead_id')
        .eq('campaign_id', campaignId)
        .limit(3);

    console.log("progress:", JSON.stringify(progress, null, 2));
}

test();
