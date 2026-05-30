import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRetroactive() {
    console.log("Fetching unmapped inbox_emails...");

    const { data: emails, error } = await supabase
        .from('inbox_emails')
        .select('id, from, subject')
        .is('campaign_id', null)
        .eq('folder', 'inbox')
        .limit(10);

    if (error) {
        console.log("Error:", error);
        return;
    }

    for (const email of emails) {
        const senderEmail = email.from.match(/<([^>]+)>/)?.[1] || email.from;
        const cleanSenderEmail = senderEmail.trim().toLowerCase();

        console.log(`Checking ${cleanSenderEmail}...`);

        const { data: leadMatch } = await supabase
            .from('leads')
            .select('id, campaign_leads!inner(campaign_id)')
            .ilike('email', cleanSenderEmail)
            .limit(1)
            .maybeSingle();

        if (leadMatch?.campaign_leads?.[0]?.campaign_id) {
            console.log(`  -> Match found! Campaign ID: ${leadMatch.campaign_leads[0].campaign_id}`);
        } else {
            console.log(`  -> No match.`);
        }
    }
}

testRetroactive();
