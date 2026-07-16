import { createClient } from '@supabase/supabase-js';
import { fetchAIChatCompletion } from './ai-client.mjs';

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
      try {
        // Build research data from lead info
        const companyName = lead.company || lead.name || 'Unknown Company';
        const website = lead.website || '';
        const aggregatedData = `
Company: ${companyName}
Website: ${website || 'N/A'}
Location: ${lead.location || 'N/A'}
Email: ${lead.email || 'N/A'}
Phone: ${lead.phone || 'N/A'}
Source: ${lead.source || 'scraped'}
Role: ${lead.role || 'N/A'}
Social: LinkedIn=${lead.linkedin || ''} Facebook=${lead.facebook || ''} Twitter=${lead.twitter || ''} Instagram=${lead.instagram || ''}
`;

        console.log(`[Research Cron] Running deep research on: ${companyName} (${lead.email})`);
        
        // Use the investigative journalist prompt for deep research
        const prompt = `You are an elite investigative business intelligence journalist. Your task is to produce a comprehensive "Deep Dive" business analysis report on the target company based on the data below.

**Target Company**: ${companyName}
${website ? `**Website**: ${website}` : ''}
**Location**: ${lead.location || 'N/A'}

RAW DATA:
${aggregatedData}

CRITICAL INSTRUCTIONS:
1. Act as a detective analyzing the company's digital footprint.
2. Identify their **niche specialization** — exactly what makes them unique in their market.
3. Identify **conversion flaws** and potential UX issues based on the data available.
4. Analyze **revenue levers** — how they make money and how they could optimize.
5. Provide **ROI projections** — estimate potential value from automation/optimization.
6. The conversation starter should be 1-2 sentences, curiosity-driven.

Format your response EXACTLY as follows (using markdown):

## ⚡ Quick Summary
[2-3 concise sentences summarizing the company and its key value proposition]

## 🔬 Deep Research

### 🎯 Niche & Market Analysis
[Their specific niche, target market, competitive positioning]

### 🔍 Website Flaws & UX Issues
[Any observations about their digital presence or potential areas for improvement]

### 💰 Revenue Levers & Growth Opportunities
[How they make money, opportunities for optimization, cross-sell/upsell potential]

### 📈 ROI Projections
[Estimated potential value from automation or optimization efforts]

### 💬 Conversation Starter
> "[Your curiosity-driven conversation starter referencing a specific detail]"`;

        const aiRes = await fetchAIChatCompletion({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          model: 'llama-3.3-70b-versatile'
        }, console.log);
        
        if (aiRes && aiRes.choices && aiRes.choices[0]) {
          const content = aiRes.choices[0].message.content;
          
          // Validate deep dive quality - must contain required sections
          const hasNicheSection = content.includes('Niche') || content.includes('Market Analysis');
          const hasGrowthSection = content.includes('Growth') || content.includes('Revenue');
          const hasROISection = content.includes('ROI') || content.includes('Projection');
          const hasQuickSummary = content.includes('Quick Summary');
          
          const isSuccessful = hasQuickSummary && hasNicheSection && hasGrowthSection && hasROISection;
          
          if (isSuccessful) {
            console.log(`[Research Cron] ✅ Deep research successful for ${companyName}`);
            
            // Update lead with research and mark as completed
            await supabase
              .from('leads')
              .update({
                summary: content,
                research_status: 'completed',
                research_attempts: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);
            
            // Find and link to campaigns (conditional campaign linking)
            await linkLeadToCampaigns(lead.id, companyName, lead.location);
            
          } else {
            console.log(`[Research Cron] ⚠️ Research incomplete for ${companyName} - missing required sections`);
            
            // Increment attempts
            const newAttempts = (lead.research_attempts || 0) + 1;
            
            if (newAttempts >= 3) {
              console.log(`[Research Cron] 🗑️ Auto-deleting lead ${companyName} after ${newAttempts} failed research attempts`);
              await supabase
                .from('leads')
                .delete()
                .eq('id', lead.id);
            } else {
              // Save partial research and increment attempts
              await supabase
                .from('leads')
                .update({
                  summary: content,
                  research_status: 'incomplete',
                  research_attempts: newAttempts,
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
            }
          }
        } else {
          // AI call failed entirely
          const newAttempts = (lead.research_attempts || 0) + 1;
          
          if (newAttempts >= 3) {
            console.log(`[Research Cron] 🗑️ Auto-deleting lead ${companyName} after ${newAttempts} failed AI attempts`);
            await supabase
              .from('leads')
              .delete()
              .eq('id', lead.id);
          } else {
            await supabase
              .from('leads')
              .update({
                research_status: 'failed',
                research_attempts: newAttempts,
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.id);
          }
        }
        
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1500));
        
      } catch (err) {
        console.error(`[Research Cron] Error processing lead ${lead.id}:`, err.message);
        
        // Increment attempts on error
        const newAttempts = (lead.research_attempts || 0) + 1;
        
        if (newAttempts >= 3) {
          console.log(`[Research Cron] 🗑️ Auto-deleting lead ${lead.company || lead.name} after error`);
          await supabase
            .from('leads')
            .delete()
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
      }
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