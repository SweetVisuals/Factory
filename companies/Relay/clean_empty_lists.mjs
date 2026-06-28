import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: lists } = await supabase.from('saved_lists').select('*, list_leads(lead_id)');
    if (!lists) {
        console.log('No lists found');
        return;
    }

    let empty = 0;
    for (const list of lists) {
        if (!list.list_leads || list.list_leads.length === 0) {
            console.log(`Deleting empty list: ${list.name}`);
            await supabase.from('saved_lists').delete().eq('id', list.id);
            empty++;
        }
    }
    console.log('Deleted ' + empty + ' empty lists');

    // Handle duplicates
    const { data: listsAfter } = await supabase.from('saved_lists').select('*');
    if (!listsAfter) return;

    const nameMap = new Map();
    for (const list of listsAfter) {
        const name = list.name.trim().toLowerCase();
        if (!nameMap.has(name)) {
            nameMap.set(name, []);
        }
        nameMap.get(name).push(list);
    }

    let mergedCount = 0;
    for (const [name, duplicates] of nameMap.entries()) {
        if (duplicates.length > 1) {
            console.log(`Found ${duplicates.length} duplicate lists for "${name}"`);
            
            // Keep the first one, move leads from others to the first, then delete others
            const [keepList, ...removeLists] = duplicates;
            
            for (const listToRemove of removeLists) {
                // Move list_leads
                const { data: leads } = await supabase.from('list_leads').select('lead_id').eq('list_id', listToRemove.id);
                if (leads && leads.length > 0) {
                    const toInsert = leads.map(l => ({ list_id: keepList.id, lead_id: l.lead_id }));
                    // Ignore duplicates
                    for (const insert of toInsert) {
                        await supabase.from('list_leads').insert(insert).select().maybeSingle();
                    }
                }
                
                await supabase.from('saved_lists').delete().eq('id', listToRemove.id);
                mergedCount++;
                console.log(`Merged and deleted duplicate: ${listToRemove.id}`);
            }
        }
    }
    console.log(`Merged ${mergedCount} duplicate lists`);
}

run().catch(console.error);
