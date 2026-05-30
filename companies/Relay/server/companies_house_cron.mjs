import { createClient } from '@supabase/supabase-js';

let supabase = null;

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchCompanyOfficers(companyName) {
  try {
    const CH_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
    if (!CH_API_KEY) {
      console.error('[Companies House Cron] Missing COMPANIES_HOUSE_API_KEY in environment!');
      return null;
    }

    const authHeader = `Basic ${Buffer.from(CH_API_KEY + ':').toString('base64')}`;

    // Clean the company name to remove SEO spam like " | Web Design" or " - Plumber"
    let cleanName = companyName.split('|')[0].split('-')[0].trim();
    
    // Search for the company
    const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(cleanName)}&items_per_page=1`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': authHeader }
    });
    
    if (!searchRes.ok) {
        console.error(`[Companies House Cron] Search API returned ${searchRes.status} for ${companyName}`);
        return null;
    }
    
    const searchData = await searchRes.json();
    if (!searchData.items || searchData.items.length === 0) return null;
    
    const companyNumber = searchData.items[0].company_number;
    
    // Fetch officers page
    const officersUrl = `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`;
    const officersRes = await fetch(officersUrl, {
      headers: { 'Authorization': authHeader }
    });
    
    if (!officersRes.ok) {
        console.error(`[Companies House Cron] Officers API returned ${officersRes.status} for ${companyNumber}`);
        return null;
    }
    
    const officersData = await officersRes.json();
    if (!officersData.items || officersData.items.length === 0) return null;
    
    // Simple extraction for the first Active Director
    for (const officer of officersData.items) {
        // 'resigned_on' is undefined if they are currently active
        // 'officer_role' is usually 'director', 'corporate-director', etc.
        if (!officer.resigned_on && officer.officer_role && officer.officer_role.toLowerCase().includes('director')) {
            return { name: officer.name, title: 'Director' };
        }
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching from Companies House API for ${companyName}:`, error.message);
    return null;
  }
}

async function runCronJob() {
  console.log('[Companies House Cron] Starting cycle...');
  try {
    // Find UK leads with a company name but no contact name
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, company, location')
      .or('name.eq.,name.is.null')
      .not('company', 'is', null)
      .limit(250);
      
    if (error) {
      console.error('[Companies House Cron] Supabase error:', error);
      return;
    }
    
    if (!leads || leads.length === 0) {
      console.log('[Companies House Cron] No pending UK leads found without names. Sleeping.');
      return;
    }

    const ukIndicators = ['uk', 'united kingdom', 'england', 'london', 'scotland', 'wales', 'gb'];
    
    for (const lead of leads) {
        if (!lead.company || lead.company.trim() === '') continue;
        
        // Check if location is UK (simple heuristic)
        const locLower = (lead.location || '').toLowerCase();
        const isUK = ukIndicators.some(ind => locLower.includes(ind));
        
        if (!isUK) continue;
        
        console.log(`[Companies House Cron] Fetching officers for: ${lead.company}`);
        const officer = await fetchCompanyOfficers(lead.company);
        
        if (officer && officer.name) {
            console.log(`[Companies House Cron] Found director: ${officer.name} for ${lead.company}`);
            
            // Format name (often "SMITH, John" -> "John Smith")
            let formattedName = officer.name;
            if (formattedName.includes(',')) {
                const parts = formattedName.split(',');
                if (parts.length === 2) {
                    formattedName = `${parts[1].trim()} ${parts[0].trim()}`.replace(/\s+/g, ' ');
                }
            }
            
            // Update the lead
            await supabase
                .from('leads')
                .update({ name: formattedName, title: officer.title })
                .eq('id', lead.id);
        } else {
            console.log(`[Companies House Cron] No director found for ${lead.company}. Marking checked...`);
            // To prevent infinite loops on unfound companies, we could set a flag, 
            // but for now we just skip. We should really set a fallback so we don't query it again.
            // A simple trick: set title to 'Unknown' so we don't query it again.
            await supabase
                .from('leads')
                .update({ title: 'Unknown' }) // Prevents endless re-fetching if we filter by title is null
                .eq('id', lead.id);
        }
        
        // Rate limiting (1 second to stay within 600 requests / 5 mins limit)
        await sleep(1000);
    }
  } catch (error) {
    console.error('[Companies House Cron] Unexpected error:', error);
  }
}

export function startCompaniesHouseCron() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Companies House Cron] Missing Supabase credentials. Cron will not start.');
    return;
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[Companies House Cron] Initialized. Running every 5 minutes.');
  // Run immediately
  runCronJob();
  // Run every 5 minutes
  setInterval(runCronJob, 5 * 60 * 1000);
}
