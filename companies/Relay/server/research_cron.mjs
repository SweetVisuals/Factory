import { createClient } from '@supabase/supabase-js';
import { fetchAIChatCompletion } from './ai-client.mjs';
import { researchAndSummarizeLead, AIRateLimitError } from './research_helper.mjs';

let supabase = null;
const failedToSaveCache = new Set();
let lastCacheClear = Date.now();

/**
 * Research Cron - Processes leads through deep research queue:
 * 1. Fetches leads needing research (no summary or empty summary)
 * 2. Runs AI deep research on each lead
 * 3. Saves structured research data to all new fields
 * 4. Validates research meets quality threshold via research_score
 * 5. Auto-marks leads as failed after 3 attempts
 * 6. Links researched leads to their campaigns
 */
async function runResearchCron() {
  console.log('[Research Cron] Checking for leads needing deep research...');
  
  try {
    // Clear cache every hour to allow retrying eventually
    if (Date.now() - lastCacheClear > 60 * 60 * 1000) {
      failedToSaveCache.clear();
      lastCacheClear = Date.now();
    }

    // Fetch leads that need research (no summary or with failed research)
    let { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .or('research_status.is.null,research_status.neq.completed')
      .lte('research_attempts', 2)
      .order('research_attempts', { ascending: true })
      .limit(30); // Fetch more in case we skip some
    
    // Filter out leads that recently failed to save
    if (leads && leads.length > 0) {
      leads = leads.filter(l => !failedToSaveCache.has(l.id)).slice(0, 10);
    }
    
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
          
          let campaignPitch = '';
          const { data: clData } = await supabase
            .from('campaign_leads')
            .select('campaign_id')
            .eq('lead_id', lead.id)
            .limit(1);
          
          if (clData && clData.length > 0) {
            const { data: cData } = await supabase
              .from('campaigns')
              .select('pitch, objective')
              .eq('id', clData[0].campaign_id)
              .single();
            if (cData) {
              campaignPitch = cData.pitch || cData.objective || '';
            }
          }

          const res = await researchAndSummarizeLead(lead, console.log, campaignPitch);
          
          // Build the update payload with all structured fields
          const isComplete = res.status === 'completed';
          const updatePayload = {
            summary: res.summary,
            research_status: res.status,
            research_attempts: isComplete ? 0 : (lead.research_attempts || 0) + 1,
            research_score: res.research_score || 0,
            research_data_raw: res.research_data_raw || null,
            researched_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Map structured data to database columns if available
          if (res.structured) {
            const s = res.structured;
            updatePayload.company_description = s.company_description || null;
            updatePayload.company_size = s.company_size || null;
            updatePayload.annual_revenue = s.annual_revenue || null;
            updatePayload.year_founded = s.year_founded || null;
            updatePayload.key_people = s.key_people && s.key_people.length > 0 ? s.key_people : [];
            updatePayload.tech_stack = s.tech_stack && s.tech_stack.length > 0 ? s.tech_stack : [];
            updatePayload.pain_points = s.pain_points && s.pain_points.length > 0 ? s.pain_points : [];
            updatePayload.bad_reviews = s.bad_reviews && s.bad_reviews.length > 0 ? s.bad_reviews : [];
            updatePayload.recent_news = s.recent_news && s.recent_news.length > 0 ? s.recent_news : [];
            updatePayload.social_presence = s.social_presence || {};
            updatePayload.services_offered = s.services_offered && s.services_offered.length > 0 ? s.services_offered : [];
            updatePayload.target_market = s.target_market || null;
            updatePayload.competitive_advantage = s.competitive_advantage || null;
            updatePayload.growth_signals = s.growth_signals && s.growth_signals.length > 0 ? s.growth_signals : [];

            // Update social media links if found in research but missing from lead
            if (s.social_presence) {
              if (s.social_presence.facebook_url && !lead.facebook) {
                updatePayload.facebook = s.social_presence.facebook_url;
              }
              if (s.social_presence.instagram_url && !lead.instagram) {
                updatePayload.instagram = s.social_presence.instagram_url;
              }
              if (s.social_presence.twitter_url && !lead.twitter) {
                updatePayload.twitter = s.social_presence.twitter_url;
              }
              if (s.social_presence.linkedin_url && !lead.linkedin) {
                updatePayload.linkedin = s.social_presence.linkedin_url;
              }
            }
          }

          // Update lead with all research data
          const { error: updateError } = await supabase
            .from('leads')
            .update(updatePayload)
            .eq('id', lead.id);
            
          if (updateError) {
            console.error(`[Research Cron] Database save failed for ${companyName}. Adding to circuit breaker cache.`);
            failedToSaveCache.add(lead.id);
            throw new Error(`Database save failed: ${updateError.message}`);
          }
            
          if (res.status === 'completed') {
            // Find and link to campaigns (conditional campaign linking)
            await linkLeadToCampaigns(lead.id, lead.company || lead.name, lead.location);
            console.log(`[Research Cron] ✅ Deep research completed for ${companyName}. Score: ${res.research_score}/100`);
          } else {
            console.log(`[Research Cron] ⚠️ Research incomplete for ${companyName}. Score: ${res.research_score}/100`);
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
              const { error: failUpdateError } = await supabase
                .from('leads')
                .update({
                  research_status: 'failed',
                  research_attempts: newAttempts,
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
              if (failUpdateError) failedToSaveCache.add(lead.id);
            } else {
              const { error: errUpdateError } = await supabase
                .from('leads')
                .update({
                  research_status: 'error',
                  research_attempts: newAttempts,
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
              if (errUpdateError) failedToSaveCache.add(lead.id);
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