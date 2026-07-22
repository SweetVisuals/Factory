import { researchAndSummarizeLead } from './research_helper.mjs';
import { supabase } from './index.mjs'; // reuse existing supabase client

// Keep track of active scrapes from index.mjs
let activeScrapesMap = null;

export function initOldLeadsMigrator(activeScrapes) {
  activeScrapesMap = activeScrapes;
  
  console.log('[Old Leads Migrator] Initialized. Checking queue every 2 minutes.');
  
  // Run every 2 minutes
  setInterval(runMigrationCycle, 2 * 60 * 1000);
  
  // Run initial check after 10 seconds
  setTimeout(runMigrationCycle, 10 * 1000);
}

async function runMigrationCycle() {
  if (!supabase) {
    console.log('[Old Leads Migrator] Supabase client not initialized yet. Skipping.');
    return;
  }

  // Check if scraper is active (busy)
  const isBusy = activeScrapesMap && activeScrapesMap.size > 0;
  if (isBusy) {
    console.log(`[Old Leads Migrator] Scraper is busy (${activeScrapesMap.size} active runs). Skipping this migration batch to avoid rate limits.`);
    return;
  }

  console.log('[Old Leads Migrator] Scraper is idle. Checking old_leads queue...');

  try {
    // 1. Fetch 3 leads from old_leads
    const { data: oldLeads, error: fetchError } = await supabase
      .from('old_leads')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(3);

    if (fetchError) {
      console.error('[Old Leads Migrator] Error fetching from old_leads:', fetchError.message);
      return;
    }

    if (!oldLeads || oldLeads.length === 0) {
      console.log('[Old Leads Migrator] No leads remaining in old_leads queue.');
      return;
    }

    console.log(`[Old Leads Migrator] Migrating ${oldLeads.length} leads from old_leads...`);

    for (const lead of oldLeads) {
      const companyName = lead.company || lead.name || 'Unknown Company';
      console.log(`[Old Leads Migrator] Processing deep research for: ${companyName}...`);

      try {
        // Run deep research
        const res = await researchAndSummarizeLead(lead, console.log, '');
        
        let researchSummary = res.summary;
        let researchStatus = res.status || 'completed';
        let structuredData = res.structured || {};
        
        // Remove duplicates
        delete structuredData.personalised_detail;
        delete structuredData.quick_fact;

        // Build lead insertion payload
        const leadData = {
          user_id: lead.user_id || 'c5f44ad2-63d1-43c2-8e17-0333d12e8643',
          company: lead.company || '',
          email: lead.email || '',
          website: lead.website || '',
          location: lead.location || '',
          phone: lead.phone || '',
          summary: researchSummary || lead.summary || '',
          source: 'migrated',
          status: 'new',
          facebook: lead.facebook || '',
          twitter: lead.twitter || '',
          instagram: lead.instagram || '',
          role: lead.role || '',
          name: (lead.name && lead.name.trim() && lead.name.trim().toLowerCase() !== 'unknown') ? lead.name.trim() : (lead.company || ''),
          research_status: researchStatus,
          tech_stack: lead.tech_stack || [],
          services_offered: lead.services_offered || [],
          industry: lead.industry || 'Letting Agencies',
          social_presence: {
            facebook_url: lead.facebook || '',
            instagram_url: lead.instagram || '',
            twitter_url: lead.twitter || '',
            linkedin_url: lead.linkedin || '',
            google_rating: null,
            review_count: null
          },
          ...structuredData,
          research_score: res.research_score || 0,
          validation_status: lead.validation_status || null,
          validation_details: lead.validation_details || null,
          updated_at: new Date().toISOString()
        };

        // Completeness filter check
        const missingFields = [];
        if (!leadData.email) missingFields.push('email');
        if (!leadData.phone) missingFields.push('phone');
        if (!leadData.website) missingFields.push('website');
        if (!leadData.industry) missingFields.push('industry');
        if (!leadData.company_size) missingFields.push('company_size');
        if (!leadData.year_founded) missingFields.push('year_founded');
        if (!leadData.annual_revenue) missingFields.push('annual_revenue');
        if (!leadData.tech_stack || leadData.tech_stack.length === 0) missingFields.push('tech_stack');
        if (!leadData.services_offered || leadData.services_offered.length === 0) missingFields.push('services_offered');
        
        const hasSocial = leadData.social_presence && (
          leadData.social_presence.facebook_url || 
          leadData.social_presence.instagram_url || 
          leadData.social_presence.twitter_url || 
          leadData.social_presence.linkedin_url
        );
        if (!hasSocial) missingFields.push('social_presence');

        if (missingFields.length > 3) {
          console.log(`[Old Leads Migrator] ⚠️ Dropped ${companyName}: Lacked too many fields (${missingFields.length} missing: ${missingFields.join(', ')}).`);
        } else {
          // Upsert to main leads table
          const { error: insertError } = await supabase
            .from('leads')
            .upsert(leadData, {
              onConflict: 'user_id,website,email',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.error(`[Old Leads Migrator] Error inserting lead ${companyName}:`, insertError.message);
          } else {
            console.log(`[Old Leads Migrator] ✅ Successfully migrated ${companyName} to main leads table.`);
          }
        }

        // Always delete from old_leads table after attempt so we don't try it again
        await supabase
          .from('old_leads')
          .delete()
          .eq('id', lead.id);

      } catch (err) {
        console.error(`[Old Leads Migrator] Error processing deep research for ${companyName}:`, err.message);
        // Delete from old_leads anyway to prevent queue stagnation on crash/error
        await supabase
          .from('old_leads')
          .delete()
          .eq('id', lead.id);
      }

      // 1.5s delay to avoid rate limit spikes during batch processing
      await new Promise(r => setTimeout(r, 1500));
    }

  } catch (err) {
    console.error('[Old Leads Migrator] Fatal migration cycle error:', err.message);
  }
}
