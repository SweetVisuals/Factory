import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: lead } = await supabase.from('leads').select('id').limit(1).single();
  const { data: campaign } = await supabase.from('campaigns').select('id').limit(1).single();
  
  if (lead && campaign) {
    const { data, error } = await supabase.from('campaign_leads').upsert({
      campaign_id: campaign.id,
      lead_id: lead.id
    });
    
    console.log("Raw insert error:", error);
  } else {
    console.log("Missing lead or campaign");
  }
}

check();
