import { supabase } from '../supabase';
import { generateUUID } from '../utils/uuid';
import { Lead } from '../../types';

export async function createList(name: string, rawLeads: Lead[], campaignId?: string) {
  // Deduplicate leads by email+website to match the DB unique constraint
  const leads = Array.from(
    new Map(rawLeads.map(lead => [`${lead.email}||${lead.website || ''}`, lead])).values()
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Create the list first
  const { data: list, error: listError } = await supabase
    .from('saved_lists')
    .insert({
      id: generateUUID(),
      user_id: user.id,
      name,
      campaign_id: campaignId,
    })
    .select()
    .single();

  if (listError) throw listError;

  // Prepare lead records for insert
  const leadsToInsert = leads.map(lead => {
    const { id: _tempId, snippet, ...leadData } = lead as any;
    return {
      id: generateUUID(),
      user_id: user.id,
      ...leadData
    };
  });

  // Insert new leads, skip any that already exist (ignoreDuplicates)
  const BATCH_SIZE = 100;
  for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
    const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
    const { error: leadsError } = await supabase
      .from('leads')
      .upsert(batch, {
        onConflict: 'user_id,website,email',
        ignoreDuplicates: true,
      });

    if (leadsError) throw leadsError;
  }

  // Now fetch the actual IDs for all leads (both newly inserted and pre-existing)
  const emails = leads.map(l => l.email);
  let allLeadIds: string[] = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const { data: matchedLeads, error: matchError } = await supabase
      .from('leads')
      .select('id, email')
      .eq('user_id', user.id)
      .in('email', chunk);

    if (matchError) throw matchError;
    
    if (matchedLeads) {
      allLeadIds = [...allLeadIds, ...matchedLeads.map(l => l.id)];
    }
  }

  // Create list associations
  for (let i = 0; i < allLeadIds.length; i += BATCH_SIZE) {
    const chunkIds = allLeadIds.slice(i, i + BATCH_SIZE);
    const { error: listLeadsError } = await supabase
      .from('list_leads')
      .insert(
        chunkIds.map(leadId => ({
          list_id: list.id,
          lead_id: leadId
        }))
      );

    if (listLeadsError) throw listLeadsError;
  }

  return list;
}

export async function fetchLists() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('saved_lists')
    .select(`
      *,
      list_leads (
        lead:leads (*)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchFolders() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('list_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createFolder(name: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('list_folders')
    .insert({
      user_id: user.id,
      name,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFolder(id: string, name: string) {
  const { error } = await supabase
    .from('list_folders')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteFolder(id: string) {
  const { error } = await supabase
    .from('list_folders')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function moveListToFolder(listId: string, folderId: string | null) {
  const { error } = await supabase
    .from('saved_lists')
    .update({ folder_id: folderId })
    .eq('id', listId);

  if (error) throw error;
}

export async function moveMultipleListsToFolder(listIds: string[], folderId: string | null) {
  if (listIds.length === 0) return;
  const { error } = await supabase
    .from('saved_lists')
    .update({ folder_id: folderId })
    .in('id', listIds);

  if (error) throw error;
}

export async function deleteList(listId: string) {
  const { error } = await supabase
    .from('saved_lists')
    .delete()
    .eq('id', listId);

  if (error) throw error;
}

export async function deleteMultipleLists(listIds: string[]) {
  if (listIds.length === 0) return;
  const { error } = await supabase
    .from('saved_lists')
    .delete()
    .in('id', listIds);

  if (error) throw error;
}

export async function addListToCampaign(listId: string, campaignId: string) {
  // Verify campaign belongs to authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('user_id')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign || campaign.user_id !== user.id) {
    throw new Error('Campaign not found or unauthorized');
  }

  // Get all leads from the list
  const { data: listLeads, error: listError } = await supabase
    .from('list_leads')
    .select('lead:leads (*)')
    .eq('list_id', listId)
    .limit(10000); // Increase limit for large lists

  if (listError) throw listError;
  if (!listLeads || listLeads.length === 0) return 0;

  // Get all existing leads in the campaign to deduplicate by email and ID
  // We use !inner to ensure we ignore any broken relationships
  const { data: existingCampaignLeads, error: existingError } = await supabase
    .from('campaign_leads')
    .select('lead_id, lead:leads!inner (email)')
    .eq('campaign_id', campaignId)
    .limit(10000); // Increase limit for existing leads in large campaigns

  if (existingError) throw existingError;

  // Create sets for existing IDs and Emails
  const existingIds = new Set(existingCampaignLeads?.map(item => item.lead_id));
  const existingEmails = new Set(
    existingCampaignLeads?.map((item: any) => item.lead?.email?.toLowerCase()).filter(Boolean) || []
  );

  // Filter out leads where the ID or email is already in the campaign
  const newAssociations = listLeads
    .filter((item: any) => {
      const lead = item.lead;
      
      // Check ID first
      if (existingIds.has(lead.id)) return false;

      // Check Email
      const email = lead?.email?.toLowerCase();
      if (email && existingEmails.has(email)) return false;

      return true;
    })
    .map((item: any) => ({
      campaign_id: campaignId,
      lead_id: item.lead.id
    }));

  // Add new associations if any
  if (newAssociations.length > 0) {
    const { error: insertError } = await supabase
      .from('campaign_leads')
      .insert(newAssociations);

    if (insertError) throw insertError;
  }

  return newAssociations.length;
}


export async function removeListFromCampaign(listId: string, campaignId: string) {
  // Get all leads from the list
  const { data: listLeads, error: listError } = await supabase
    .from('list_leads')
    .select('lead_id')
    .eq('list_id', listId);

  if (listError) throw listError;

  // Remove leads from campaign
  const { error: campaignError } = await supabase
    .from('campaign_leads')
    .delete()
    .eq('campaign_id', campaignId)
    .in('lead_id', listLeads.map(l => l.lead_id));

  if (campaignError) throw campaignError;
}

export async function removeDuplicatesFromList(listId: string) {
  // Get all leads in the list
  const { data: listLeads, error: listError } = await supabase
    .from('list_leads')
    .select(`
      lead_id,
      lead:leads (
        id,
        email
      )
    `)
    .eq('list_id', listId);

  if (listError) throw listError;
  if (!listLeads || listLeads.length === 0) return 0;

  // Group by email to find duplicates
  const emailMap = new Map<string, any[]>();
  
  listLeads.forEach((item: any) => {
    const email = item.lead?.email?.toLowerCase();
    if (email) {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(item);
    }
  });

  const leadIdsToRemove: string[] = [];

  // For each email, keep one and remove the rest
  emailMap.forEach((items) => {
    if (items.length > 1) {
      const [_keep, ...remove] = items;
      remove.forEach(item => leadIdsToRemove.push(item.lead_id));
    }
  });

  if (leadIdsToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('list_leads')
      .delete()
      .eq('list_id', listId)
      .in('lead_id', leadIdsToRemove);

    if (deleteError) throw deleteError;
  }

  return leadIdsToRemove.length;
}

export async function removeLeadFromList(listId: string, leadId: string) {
  const { error } = await supabase
    .from('list_leads')
    .delete()
    .eq('list_id', listId)
    .eq('lead_id', leadId);

  if (error) throw error;
}

export async function removeLeadsFromList(listId: string, leadIds: string[]) {
  if (leadIds.length === 0) return;
  
  // Deleting in chunks of 100 to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
    const chunk = leadIds.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('list_leads')
      .delete()
      .eq('list_id', listId)
      .in('lead_id', chunk);

    if (error) throw error;
  }
}

export interface CrossListDuplicate {
  email: string;
  lists: { listId: string; listName: string; leadId: string; listLeadId: string }[];
}

export function findCrossListDuplicates(lists: any[]): CrossListDuplicate[] {
  // Map email -> array of { listId, listName, leadId, listLeadId }
  const emailMap = new Map<string, { listId: string; listName: string; leadId: string; listLeadId: string }[]>();

  for (const list of lists) {
    if (!list.list_leads) continue;
    for (const item of list.list_leads) {
      const email = item.lead?.email?.toLowerCase();
      if (!email) continue;
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push({
        listId: list.id,
        listName: list.name,
        leadId: item.lead.id,
        listLeadId: item.lead_id ?? item.lead.id,
      });
    }
  }

  // Filter to only emails that appear in more than one distinct list
  const duplicates: CrossListDuplicate[] = [];
  emailMap.forEach((entries, email) => {
    const uniqueListIds = new Set(entries.map(e => e.listId));
    if (uniqueListIds.size > 1) {
      duplicates.push({ email, lists: entries });
    }
  });

  return duplicates.sort((a, b) => b.lists.length - a.lists.length);
}

export async function removeDuplicateEntries(entriesToRemove: { listId: string; leadId: string }[]) {
  let removedCount = 0;
  for (const entry of entriesToRemove) {
    const { error } = await supabase
      .from('list_leads')
      .delete()
      .eq('list_id', entry.listId)
      .eq('lead_id', entry.leadId);

    if (error) throw error;
    removedCount++;
  }
  return removedCount;
}
