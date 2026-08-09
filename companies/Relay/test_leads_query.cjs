const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const url = 'https://db.relaysolutions.net/rest/v1';
const campaignId = '038aa8c6-7b86-486b-95be-95fdfc76dbb0';

async function run() {
  const cRes = await fetch(`${url}/campaigns?id=eq.${campaignId}`, { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }});
  const cData = await cRes.json();
  const userId = cData[0].user_id;

  console.log("Fetching leads with nested select, userId:", userId);
  const res = await fetch(`${url}/campaign_leads?campaign_id=eq.${campaignId}&select=leads(*)&leads.user_id=eq.${userId}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const data = await res.json();
  console.log("Nested data count:", data.filter(d => d.leads !== null).length);
}
run();
