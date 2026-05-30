import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Openclaw Factory/backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCampaigns() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  
  if (authError || !authData.session) {
    console.error("Auth failed:", authError);
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  console.log("Fetching campaigns...");
  const { data: campaigns, error } = await client.from('campaigns').select('id, name, status, business_id');
  
  if (error) {
    console.error("Error fetching campaigns:", error);
    return;
  }

  for (const c of campaigns) {
    console.log(`Campaign: ${c.name} | Status: ${c.status} | Biz: ${c.business_id}`);
    
    if (!c.business_id) {
       let bizId = null;
       const nameLower = c.name.toLowerCase();
       if (nameLower.includes('medical') || nameLower.includes('event') || nameLower.includes('function') || nameLower.includes('festival')) {
           bizId = '0269fe06-4607-4c58-9263-12a3930a1dc3'; // MrMedic
       } else {
           bizId = '102a3bca-7b0a-4cee-bd33-fefd7b4450b4'; // Relay
       }
       console.log(` -> Fixing business_id to ${bizId}`);
       await client.from('campaigns').update({ business_id: bizId }).eq('id', c.id);
    }
  }
  console.log("Done.");
}

fixCampaigns();
