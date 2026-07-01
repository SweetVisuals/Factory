require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

// Fallback to local env variables if not running in GitHub Actions
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runScraper() {
  console.log("Starting Daily Scraper Job...");
  
  // Here we simulate fetching data from a free public API or running a basic deterministic scrape
  // Since we aren't using AI, this is a hardcoded example pipeline that would typically use cheerio/puppeteer
  
  const mockLeads = [
    {
      company: "TechNova Solutions",
      industry: "Software Development",
      website: "technova.example.com",
      email: "info@technova.example.com",
      name: "Alice Vance",
      title: "CTO",
      status: "new",
      validation_status: "unverified",
      source: "automated_cron_job"
    },
    {
      company: "Apex Logistics",
      industry: "Transportation",
      website: "apexlogistics.example.com",
      email: "ops@apexlogistics.example.com",
      name: "Bob Vance",
      title: "Operations Director",
      status: "new",
      validation_status: "unverified",
      source: "automated_cron_job"
    }
  ];

  console.log(`Found ${mockLeads.length} leads. Upserting to Supabase...`);

  // Assuming a 'leads' table exists based on standard B2B setup
  const { data, error } = await supabase
    .from('leads')
    .upsert(mockLeads, { onConflict: 'user_id,website,email' });

  if (error) {
    console.error("Error inserting leads:", error);
    process.exit(1);
  }

  console.log("Successfully updated Supabase with new leads.");
  
  // Optionally update system logs
  await supabase.from('chat_logs').insert([{
    agent_name: 'CRON_SYSTEM',
    message: `Automated daily scrape completed successfully. Added/Updated ${mockLeads.length} leads.`,
  }]);
}

runScraper()
  .then(() => {
    console.log("Job finished.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Job failed:", err);
    process.exit(1);
  });
