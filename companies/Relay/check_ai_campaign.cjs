const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const url = 'https://db.relaysolutions.net/rest/v1';

async function query() {
  // Get campaign ID
  const campRes = await fetch(`${url}/campaigns?name=ilike.*AI %26 Automation*`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const camps = await campRes.json();
  if (!camps.length) {
    console.log("Campaign not found");
    return;
  }
  const camp = camps[0];
  console.log("Campaign:", camp.name, camp.id);

  // Check campaign_progress
  const progRes = await fetch(`${url}/campaign_progress?campaign_id=eq.${camp.id}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const prog = await progRes.json();
  console.log("Progress:", prog[0]);

  // Check campaign_leads
  const leadsRes = await fetch(`${url}/campaign_leads?campaign_id=eq.${camp.id}&select=*,leads(*)`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const leads = await leadsRes.json();
  console.log("Campaign Leads Count:", leads.length);
  if (leads.length > 0) {
    console.log("Sample lead status:", leads[0].status, leads[0].leads ? "Has lead joined" : "No joined lead");
  }

  // Find if there are any leads created directly referencing this campaign if that's how it works
}
query();
