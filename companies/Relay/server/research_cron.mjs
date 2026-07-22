import { createClient } from '@supabase/supabase-js';
import { fetchAIChatCompletion } from './ai-client.mjs';
import { researchAndSummarizeLead, AIRateLimitError } from './research_helper.mjs';

let supabase = null;

/**
 * Research Cron - Processes leads through deep research queue:
 * 1. Fetches leads needing research (no summary or empty summary)
 * 2. Runs AI deep research on each lead
 * 3. Validates research meets quality threshold (Niche & Market, Growth, ROI)
 * 4. Auto-deletes leads that fail after 3 attempts
 * 5. Links researched leads to their campaigns
 */
async function runResearchCron() {
  console.log('[Research Cron] Checking for leads needing deep research...');
  
  try {
    // Fetch leads that need research (no summary or with failed research)
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .or('research_status.is.null,research_status.neq.completed')
      .lte('research_attempts', 2)
      .order('research_attempts', { ascending: true })
      .limit(10); // Process 10 leads at a time
    
    if (leadsError) {
      console.error('[Research Cron] Error fetching leads:', leadsError.message);
      return;
    }
    
    if (!leads || leads.length === 0) {
      console.log('[Research Cron] No leads pending research.');
      return;
    }
    
    console.log(`[Research Cron] Processing ${leads.length} leads for deep research...`);
    
    for (const lead of leads) {
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (attempts < maxAttempts && !success) {
        try {
          const companyName = lead.company || lead.name || 'Unknown Company';
          console.log(`[Research Cron] Running deep research on: ${companyName} (${lead.email})`);
          
          const res = await researchAndSummarizeLead(lead, console.log);
          
          // Update lead with research and mark as completed/incomplete
          await supabase
            .from('leads')
            .update({
              summary: res.summary,
              research_status: res.status,
              research_attempts: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', lead.id);
            
          if (res.status === 'completed') {
            // Find and link to campaigns (conditional campaign linking)
            await linkLeadToCampaigns(lead.id, companyName, lead.location);
          }
          
          success = true;
        } catch (err) {
          if (err instanceof AIRateLimitError) {
            console.log(`[Research Cron] Rate limit hit. Pausing research cron for 60 seconds before retry...`);
            await new Promise(r => setTimeout(r, 60000));
            attempts++;
          } else {
            console.error(`[Research Cron] Error processing lead ${lead.id}:`, err.message);
            const newAttempts = (lead.research_attempts || 0) + 1;
            
            if (newAttempts >= 3) {
              console.log(`[Research Cron] ⚠️ Research failed after 3 attempts for ${lead.company || lead.name}. Marking as failed (lead preserved).`);
              await supabase
                .from('leads')
                .update({
                  research_status: 'failed',
                  research_attempts: newAttempts,
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
            } else {
              await supabase
                .from('leads')
                .update({
                  research_status: 'error',
                  research_attempts: newAttempts,
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
            }
            break;
          }
        }
      }
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`[Research Cron] Batch complete. Processed ${leads.length} leads.`);
    
  } catch (error) {
    console.error('[Research Cron] Run failed:', error.message);
  }
}

/**
 * Link a researched lead to matching campaigns.
 * Only links if AI research was successful (meets "Deep Dive" maturity criteria).
 */
async function linkLeadToCampaigns(leadId, companyName, location) {
  try {
    // Find active campaigns that match this lead's niche/industry
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, niche')
      .in('status', ['draft', 'in_progress', 'active']);
    
    if (!campaigns || campaigns.length === 0) return;
    
    const searchText = `${companyName} ${location || ''}`.toLowerCase();
    let matchedCampaignId = null;
    
    for (const camp of campaigns) {
      const nicheWords = (camp.niche || camp.name || '').toLowerCase().split(/[\s,-]+/);
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
      const { error } = await supabase
        .from('campaign_leads')
        .upsert({
          campaign_id: matchedCampaignId,
          lead_id: leadId
        }, { onConflict: 'campaign_id,lead_id' });
      
      if (error) {
        console.error(`[Research Cron] Error linking lead ${leadId} to campaign:`, error.message);
      } else {
        console.log(`[Research Cron] ✅ Linked researched lead ${leadId} to campaign ${matchedCampaignId}`);
      }
    }
  } catch (err) {
    console.error('[Research Cron] Campaign linking error:', err.message);
  }
}

export function startResearchCron() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Research Cron] Missing Supabase credentials. Cron will not start.');
    return;
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('[Research Cron] Initialized. Processing research queue every 30 seconds.');
  
  // Run immediately on startup, then every 30 seconds
  setTimeout(() => {
    runResearchCron();
    setInterval(runResearchCron, 30 * 1000);
  }, 3 * 1000);
}