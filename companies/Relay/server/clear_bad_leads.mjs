import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanBadLeads() {
    console.log('[Cleanup] Searching for corrupt leads with "Failed to scrape" or Chrome/Puppeteer errors...');
    
    const { data: badSummary, error: e1 } = await supabase.from('leads').select('id, company, summary, company_description').ilike('summary', '%Failed to scrape%');
    const { data: badDesc, error: e2 } = await supabase.from('leads').select('id, company, summary, company_description').ilike('company_description', '%Failed to scrape%');
    const { data: badChrome, error: e3 } = await supabase.from('leads').select('id, company, summary, company_description').ilike('summary', '%Could not find Chrome%');
    const { data: badPuppeteer, error: e4 } = await supabase.from('leads').select('id, company, summary, company_description').ilike('summary', '%puppeteer%');
    
    const allBadLeads = [
        ...(badSummary || []),
        ...(badDesc || []),
        ...(badChrome || []),
        ...(badPuppeteer || [])
    ];
    
    const badIds = [...new Set(allBadLeads.map(l => l.id))];
    console.log(`[Cleanup] Found ${badIds.length} corrupt leads to purge.`);
    
    if (badIds.length > 0) {
        // Remove from campaign_leads join table first
        await supabase.from('campaign_leads').delete().in('lead_id', badIds);
        // Remove from leads
        const { error: delErr } = await supabase.from('leads').delete().in('id', badIds);
        if (delErr) {
            console.error('[Cleanup Error] Failed to delete leads:', delErr.message);
        } else {
            console.log(`[Cleanup Success] Purged ${badIds.length} bad leads from the database successfully!`);
        }
    } else {
        console.log('[Cleanup] Database is clean! No corrupted leads found.');
    }
}

cleanBadLeads().catch(console.error);
