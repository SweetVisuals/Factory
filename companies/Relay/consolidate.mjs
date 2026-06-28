import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const getCategory = (listName) => {
  const match = listName.match(/\(([^)]+)\)/);
  if (!match) return "Other";
  
  const tag = match[1].toLowerCase();
  
  if (tag.includes('dental') || tag.includes('dentist') || tag.includes('healthcare')) return "Healthcare & Dental";
  if (tag.includes('construction') || tag.includes('civil') || tag.includes('building')) return "Construction & Civils";
  if (tag.includes('event') || tag.includes('hotel') || tag.includes('conference') || tag.includes('media') || tag.includes('film') || tag.includes('post-production')) return "Media & Events";
  if (tag.includes('consulting') || tag.includes('automation') || tag.includes('management') || tag.includes('workflow')) return "Consulting & Tech";
  if (tag.includes('web development')) return "Consulting & Tech";
  
  return "Other";
};

async function consolidateLists() {
  console.log("Starting consolidation...");
  
  // 1. Fetch current lists
  const { data: lists, error: listsErr } = await supabase.from('saved_lists').select('*');
  if (listsErr) throw listsErr;
  
  if (!lists || lists.length === 0) {
    console.log("No lists to consolidate.");
    return;
  }
  
  // We need the user_id to associate folders and lists. We will pick the user_id from the first list.
  const userId = lists[0].user_id;

  // 2. Fetch current folders
  const { data: folders, error: foldersErr } = await supabase.from('list_folders').select('*');
  if (foldersErr) throw foldersErr;
  
  const folderMap = new Map();
  folders.forEach(f => folderMap.set(f.name, f.id));

  // 3. Define high-level categories and ensure folders exist
  const categories = ["Healthcare & Dental", "Construction & Civils", "Media & Events", "Consulting & Tech", "Other"];
  
  for (const cat of categories) {
    if (!folderMap.has(cat)) {
      console.log(`Creating folder: ${cat}`);
      const folderId = crypto.randomUUID();
      const { error } = await supabase.from('list_folders').insert({ id: folderId, user_id: userId, name: cat });
      if (error) throw error;
      folderMap.set(cat, folderId);
    }
  }

  // 4. Create Master Lists for each category if they don't exist
  const masterListMap = new Map();
  for (const cat of categories) {
    const masterName = `Master Registry: ${cat}`;
    const existing = lists.find(l => l.name === masterName);
    if (existing) {
      masterListMap.set(cat, existing.id);
    } else {
      console.log(`Creating Master List: ${masterName}`);
      const listId = crypto.randomUUID();
      const { error } = await supabase.from('saved_lists').insert({
        id: listId,
        user_id: userId,
        name: masterName,
        folder_id: folderMap.get(cat)
      });
      if (error) throw error;
      masterListMap.set(cat, listId);
    }
  }

  // 5. Migrate leads from old lists to master lists
  const oldLists = lists.filter(l => !l.name.startsWith('Master Registry:'));
  
  for (const list of oldLists) {
    const cat = getCategory(list.name);
    const masterId = masterListMap.get(cat);
    
    // Fetch list_leads for this list
    const { data: listLeads, error: llErr } = await supabase.from('list_leads').select('lead_id').eq('list_id', list.id);
    if (llErr) throw llErr;
    
    if (listLeads && listLeads.length > 0) {
      const inserts = listLeads.map(ll => ({
        list_id: masterId,
        lead_id: ll.lead_id
      }));
      
      console.log(`Migrating ${inserts.length} leads from "${list.name}" to "${cat}"...`);
      // Use ignoreDuplicates in upsert if possible, or just insert and ignore conflicts
      const { error: insErr } = await supabase.from('list_leads').upsert(inserts, { onConflict: 'list_id,lead_id', ignoreDuplicates: true });
      if (insErr) {
        console.error(`Error migrating leads for ${list.name}:`, insErr);
      }
    }
    
    // 6. Delete old list
    console.log(`Deleting old list: ${list.name}`);
    await supabase.from('saved_lists').delete().eq('id', list.id);
  }
  
  console.log("Consolidation complete!");
}

consolidateLists().catch(console.error);
