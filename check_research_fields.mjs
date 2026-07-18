import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lvqmlvbclglalcnfowwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cW1sdmJjbGdsYWxjbmZvd3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxNTMsImV4cCI6MjA5OTU4OTE1M30.PHOdd5mlqBN3RAdz2w0ye64fBgDXAa7e8kto28pzIuU'
);

async function checkResearchFields() {
  try {
    console.log('=== CHECKING RESEARCH FIELDS IN DATABASE ===\n');
    
    // Get a sample lead with research data
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Sample leads and their research-related fields:\n');
    
    leads?.forEach((lead, i) => {
      const hasResearch = lead.research_status || lead.summary || lead.company_news;
      if (hasResearch) {
        console.log(`Lead ${i + 1}:`, {
          name: lead.name,
          email: lead.email,
          research_status: lead.research_status,
          summary: lead.summary ? lead.summary.substring(0, 100) + '...' : null,
          company_news: lead.company_news ? lead.company_news.substring(0, 100) + '...' : null
        });
      }
    });
    
    // Count leads with research data
    const { count: withSummary } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('summary', 'is', null);
    
    const { count: withResearchStatus } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('research_status', 'is', null);
    
    const { count: withCompanyNews } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('company_news', 'is', null);
    
    console.log('\n=== RESEARCH DATA STATS ===');
    console.log('Leads with summary:', withSummary);
    console.log('Leads with research_status:', withResearchStatus);
    console.log('Leads with company_news:', withCompanyNews);
    
    // Get column names from a lead
    if (leads && leads.length > 0) {
      console.log('\n=== ALL COLUMNS IN LEADS TABLE ===');
      console.log(Object.keys(leads[0]).join('\n'));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkResearchFields();