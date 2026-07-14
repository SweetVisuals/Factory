import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: campaign } = await client.from('campaigns').select('id').limit(1).single();
  const { data: lead } = await client.from('leads').select('id').limit(1).single();
  
  if (campaign && lead) {
    const result = await client
      .from('campaign_leads')
      .upsert({
        campaign_id: campaign.id,
        lead_id: lead.id
      }, { onConflict: 'campaign_id,lead_id' })
      .select()
      .single();

    console.log("Upsert result:", result);
  }
}

check();
