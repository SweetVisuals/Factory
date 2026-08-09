import { createClient } from '@supabase/supabase-js';
import { performDeterministicResearch } from './scraper_tools.mjs';

async function blast() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
    console.log('Starting fast reputation blast...');
    let processed = 0;
    
    while (true) {
        const { data: leads } = await supabase
            .from('leads')
            .select('id, company, name, website')
            .eq('review_count', 0)
            .limit(20);
        
        if (!leads || leads.length === 0) break;
        
        console.log(`Processing batch of ${leads.length} leads...`);
        
        await Promise.all(leads.map(async (lead) => {
            try {
                await supabase.from('leads').update({ research_status: 'pending' }).eq('id', lead.id);
                const jsonStr = await performDeterministicResearch(lead.company || lead.name, lead.website || '', '');
                if (jsonStr && !jsonStr.includes('"error":')) {
                    const parsed = JSON.parse(jsonStr);
                    await supabase.from('leads').update({
                        research_status: 'completed',
                        researched_at: new Date().toISOString(),
                        review_count: parsed.google_data?.reviews ? parseInt(parsed.google_data.reviews.replace(/,/g, ''), 10) : 0,
                        bad_reviews: parsed.bad_reviews || []
                    }).eq('id', lead.id);
                    console.log('Processed:', lead.company || lead.name);
                    processed++;
                }
            } catch (e) {
                console.log('Error processing lead:', lead.id, e.message);
            }
        }));
    }
    console.log('Blast complete! Processed', processed, 'leads');
    process.exit(0);
}

blast();
