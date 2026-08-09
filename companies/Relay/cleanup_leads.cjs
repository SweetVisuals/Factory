const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const url = 'https://db.relaysolutions.net/rest/v1';
const adminUserId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
const campaignId = '038aa8c6-7b86-486b-95be-95fdfc76dbb0';

async function cleanup() {
  console.log('Fetching leads for campaign:', campaignId);
  const clRes = await fetch(`${url}/campaign_leads?campaign_id=eq.${campaignId}&select=leads(*)`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const data = await clRes.json();
  
  if (!data || data.length === 0) {
    console.log('No leads found.');
    return;
  }
  
  const badLeads = [];
  
  data.forEach(cl => {
    if (cl.leads) {
      const loc = (cl.leads.location || '').toLowerCase();
      // If it doesn't contain london, we mark it as bad
      if (!loc.includes('london')) {
        badLeads.push({ id: cl.leads.id, company: cl.leads.company, location: loc });
      }
    }
  });
  
  console.log(`Found ${badLeads.length} bad leads not in London:`, badLeads);
  
  if (badLeads.length > 0) {
    const idsToDelete = badLeads.map(l => l.id);
    
    // Delete from campaign_leads first
    const delCl = await fetch(`${url}/campaign_leads?lead_id=in.(${idsToDelete.join(',')})&campaign_id=eq.${campaignId}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    console.log('Deleted from campaign_leads:', delCl.ok);
    
    // Delete from leads
    const delL = await fetch(`${url}/leads?id=in.(${idsToDelete.join(',')})`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    console.log('Deleted from leads:', delL.ok);
    
    // Update campaign prospects count
    const remaining = data.length - badLeads.length;
    await fetch(`${url}/campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: { 
        'apikey': SERVICE_KEY, 
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prospects: remaining })
    });
    console.log(`Updated campaign prospects to ${remaining}`);
  }
}

cleanup();
