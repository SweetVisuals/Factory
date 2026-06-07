const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function wipe() {
    console.log("Wiping campaign_progress...");
    await supabase.from('campaign_progress').delete().not('campaign_id', 'is', null);

    console.log("Wiping campaign_leads...");
    await supabase.from('campaign_leads').delete().not('campaign_id', 'is', null);

    console.log("Wiping scheduled_emails...");
    await supabase.from('scheduled_emails').delete().not('campaign_id', 'is', null);
    
    console.log("Wiping list_leads...");
    await supabase.from('list_leads').delete().not('list_id', 'is', null);

    console.log("Wiping campaigns...");
    const { error: cErr } = await supabase.from('campaigns').delete().not('id', 'is', null);
    if (cErr) console.error("Error wiping campaigns:", cErr);

    console.log("Wiping leads...");
    const { error: lErr } = await supabase.from('leads').delete().not('id', 'is', null);
    if (lErr) console.error("Error wiping leads:", lErr);

    console.log("Done.");
}

wipe().catch(console.error);
