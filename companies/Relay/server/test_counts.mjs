import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCounts() {
    const campaignId = '1a695f28-c0b6-41cc-9c04-71f64af4c539';
    console.log("Testing counts for campaign:", campaignId);

    const { data: campaignAccounts } = await supabase
        .from('campaign_email_accounts')
        .select('email_account_id')
        .eq('campaign_id', campaignId);

    const accountIds = campaignAccounts?.map(ca => ca.email_account_id) || [];
    console.log("Found accounts:", accountIds);

    if (accountIds.length > 0) {
        const [inboxRes, sentRes] = await Promise.all([
            supabase.from('inbox_emails').select('id', { count: 'exact', head: true }).eq('folder', 'inbox').in('email_account_id', accountIds),
            supabase.from('inbox_emails').select('id', { count: 'exact', head: true }).eq('folder', 'sent').in('email_account_id', accountIds)
        ]);

        console.log(`Inbox count: ${inboxRes.count}, Sent count: ${sentRes.count}`);
    } else {
        console.log("No accounts found");
    }
}

testCounts();
