import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function runAutoAssignCron() {
  try {
    // Auth
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'ptnmgmt@gmail.com',
      password: 'Longlonglong1!'
    });
    if (!authData?.session) return;
    
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    // Get active/draft campaigns
    const { data: campaigns } = await client.from('campaigns').select('id, name, niche, status').in('status', ['draft', 'in_progress', 'active']);
    if (!campaigns || campaigns.length === 0) return;

    // Fetch leads from the last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { data: recentLeads } = await client
      .from('leads')
      .select('id, company, location, name, validation_details')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (!recentLeads || recentLeads.length === 0) return;

    // Fetch existing assignments for these leads
    const leadIds = recentLeads.map(l => l.id);
    const { data: existingAssignments } = await client
      .from('campaign_leads')
      .select('lead_id')
      .in('lead_id', leadIds);

    const assignedSet = new Set(existingAssignments?.map(a => a.lead_id) || []);
    
    // Filter out already assigned, already reviewed by AI, or currently processing
    const unassignedLeads = recentLeads.filter(l => 
        !assignedSet.has(l.id) && 
        !(l.validation_details || '').includes('[AI_REVIEWED]') &&
        !(l.validation_details || '').includes('[PROCESSING_ASSIGNMENT]')
    );

    if (unassignedLeads.length === 0) return;

    console.log(`[Auto-Assign Cron] Found ${unassignedLeads.length} potentially unassigned leads. Claiming...`);

    const claimedLeads = [];
    for (const lead of unassignedLeads) {
      try {
        const currentDetails = lead.validation_details || '';
        const newDetails = currentDetails ? `${currentDetails} [PROCESSING_ASSIGNMENT]` : '[PROCESSING_ASSIGNMENT]';
        
        // Atomic claim update
        const { data: claimed, error: claimErr } = await client
          .from('leads')
          .update({ validation_details: newDetails })
          .eq('id', lead.id)
          .or('validation_details.is.null,validation_details.not.like.*[PROCESSING_ASSIGNMENT]*,validation_details.eq.')
          .select();
        
        if (!claimErr && claimed && claimed.length > 0) {
          lead.validation_details = newDetails;
          claimedLeads.push(lead);
        }
      } catch (e) {
        console.error(`[Auto-Assign Cron] Error claiming lead ${lead.id}:`, e.message);
      }
    }

    if (claimedLeads.length === 0) {
      console.log('[Auto-Assign Cron] All candidates were already claimed by other instances.');
      return;
    }

    console.log(`[Auto-Assign Cron] Successfully claimed ${claimedLeads.length} leads for this run.`);

    let scriptAssignedCount = 0;
    const aiLeads = [];
    const scriptAssignedLeads = [];

    // Pass 1: Simple Script Matching
    for (const lead of claimedLeads) {
      const c = (lead.company || '').toLowerCase();
      const l = (lead.location || '').toLowerCase();
      const searchText = c + ' ' + l;

      let matchedCampaignId = null;

      for (const camp of campaigns) {
        const nicheWords = (camp.niche || camp.name || '').toLowerCase().split(/[\s,-]+/);
        // Find if any meaningful niche word matches
        const hasMatch = nicheWords.some(w => {
           w = w.trim();
           if (w.length < 4) return false;
           if (['the', 'and', 'for', 'inc', 'ltd', 'services', 'agency'].includes(w)) return false;
           return searchText.includes(w);
        });

        if (hasMatch) {
          matchedCampaignId = camp.id;
          break;
        }
      }

      if (matchedCampaignId) {
        // Assign
        await client.from('campaign_leads').upsert({
          campaign_id: matchedCampaignId,
          lead_id: lead.id
        }, { onConflict: 'campaign_id,lead_id' });
        scriptAssignedCount++;
        scriptAssignedLeads.push(lead);
        
        // Update prospect count
        const { count } = await client.from('campaign_leads')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', matchedCampaignId);
        await client.from('campaigns').update({ prospects: count || 0 }).eq('id', matchedCampaignId);
      } else {
        // Queue for AI
        aiLeads.push(lead);
      }
    }

    console.log(`[Auto-Assign Cron] Script matched and assigned ${scriptAssignedCount} leads.`);

    // Clean up claim lock for script-assigned leads (remove [PROCESSING_ASSIGNMENT])
    for (const lead of scriptAssignedLeads) {
      const details = lead.validation_details || '';
      const cleanDetails = details.replace('[PROCESSING_ASSIGNMENT]', '').trim();
      await client.from('leads').update({ validation_details: cleanDetails }).eq('id', lead.id);
    }

    const validatorBatchSize = 20;
    let validatorBatch = [];
    let unhandledAILeads = [];

    if (aiLeads.length > 0) {
      validatorBatch = aiLeads.slice(0, validatorBatchSize); // Process max 20 at a time to keep AI prompt small
      unhandledAILeads = aiLeads.slice(validatorBatchSize); // The rest must release their claim lock
      
      const campaignsInfo = campaigns.map(c => ({ id: c.id, name: c.name, niche: c.niche }));
      
      const prompt = `### Niche Matching & Campaign Assignment
The automated script could not confidently match the following ${validatorBatch.length} leads to a campaign.
Please review these leads and assign them to the most appropriate active campaign based on their company name and location.

**Active Campaigns:**
\`\`\`json
${JSON.stringify(campaignsInfo, null, 2)}
\`\`\`

**Unassigned Leads:**
\`\`\`json
${JSON.stringify(validatorBatch.map(l => ({ id: l.id, company: l.company, location: l.location })), null, 2)}
\`\`\`

**Action Required:**
1. Identify which campaign best fits each lead's niche/industry.
2. Group the leads by their target campaign ID.
3. Call \`RELAY_API: ASSIGN_LEADS | {"campaignId": "uuid", "leadIds": ["uuid1", ...]}\` for each matched campaign to assign them.
4. If a lead does not fit ANY campaign, ignore it.`;

      console.log(`[Auto-Assign Cron] Handing off ${validatorBatch.length} leads to Validator AI...`);
      await client.from('tasks').insert([{
        assigned_to: 'Validator',
        description: prompt,
        status: 'pending'
      }]);
      
      // Update validation_details to replace claim lock with [AI_REVIEWED]
      for (const lead of validatorBatch) {
         const details = lead.validation_details || 'Unverified';
         const cleanDetails = details.replace('[PROCESSING_ASSIGNMENT]', '').trim();
         const finalDetails = cleanDetails.includes('[AI_REVIEWED]') ? cleanDetails : `${cleanDetails} [AI_REVIEWED]`.trim();
         await client.from('leads').update({ validation_details: finalDetails }).eq('id', lead.id);
      }
    }

    // Release claim lock for any AI candidates that were NOT processed in this batch (unhandledAILeads)
    for (const lead of unhandledAILeads) {
      const details = lead.validation_details || '';
      const cleanDetails = details.replace('[PROCESSING_ASSIGNMENT]', '').trim();
      await client.from('leads').update({ validation_details: cleanDetails }).eq('id', lead.id);
    }

  } catch (error) {
    console.error('[Auto-Assign Cron] Error:', error);
  }
}

export function startAutoAssignCron() {
  console.log('[Auto-Assign Cron] Starting background job (runs every 10 mins)...');
  // Initial run delay to allow DB connection to settle
  setTimeout(runAutoAssignCron, 5000);
  
  // Run every 10 minutes
  setInterval(runAutoAssignCron, 10 * 60 * 1000);
}
