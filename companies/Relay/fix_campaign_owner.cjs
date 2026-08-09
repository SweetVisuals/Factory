const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We use check_rls style fetch to just execute SQL if pg is annoying, 
// But we actually have scratch/migrate.sql which we can use, OR just use fetch with supabase rest api.
// Let's use the fetch API since it bypasses RLS if we use the service key.

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const url = 'https://db.relaysolutions.net/rest/v1';
const adminUserId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';

async function fixOwners() {
  // 1. Get all campaigns
  const campRes = await fetch(`${url}/campaigns?select=id,user_id`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const campaigns = await campRes.json();
  console.log(`Found ${campaigns.length} campaigns`);

  for (const camp of campaigns) {
    // 2. Get all campaign_leads for this campaign
    const clRes = await fetch(`${url}/campaign_leads?campaign_id=eq.${camp.id}&select=lead_id`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const cls = await clRes.json();
    if (!cls || cls.length === 0) continue;
    
    const leadIds = cls.map(c => c.lead_id);
    
    // 3. Update the leads to match the campaign's user_id if they currently belong to the admin user
    // We can do this in batches
    console.log(`Campaign ${camp.id} has ${leadIds.length} leads. Setting owner to ${camp.user_id}`);
    
    for (let i = 0; i < leadIds.length; i += 50) {
      const chunk = leadIds.slice(i, i + 50);
      const updateRes = await fetch(`${url}/leads?id=in.(${chunk.join(',')})&user_id=eq.${adminUserId}`, {
        method: 'PATCH',
        headers: { 
          'apikey': SERVICE_KEY, 
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ user_id: camp.user_id })
      });
      
      if (updateRes.ok) {
        const updated = await updateRes.json();
        console.log(`Successfully updated ${updated.length} leads in chunk for campaign ${camp.id}`);
      } else {
        console.error(`Failed to update leads chunk for campaign ${camp.id}:`, await updateRes.text());
      }
    }
  }
}

fixOwners();
