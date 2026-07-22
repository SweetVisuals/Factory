import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateEmail } from '../companies/Relay/server/email_engine.mjs';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, name');
  
  for (const campaign of campaigns) {
    try {
      console.log(`\nTesting Campaign "${campaign.name}" (${campaign.id}):`);
      
      const { data: campaignData, error: campErr } = await supabase
        .from('campaigns')
        .select('*, businesses(*)')
        .eq('id', campaign.id)
        .single();
        
      if (campErr) throw campErr;
      
      const { data: campLeads, error: leadErr } = await supabase
        .from('campaign_leads')
        .select('leads(*)')
        .eq('campaign_id', campaign.id)
        .limit(1);
        
      if (leadErr) throw leadErr;
      
      if (!campLeads || campLeads.length === 0) {
        console.log('-> No leads in campaign_leads.');
        continue;
      }
      
      const lead = campLeads[0].leads;
      if (!lead) {
        console.log('-> Leads field in campaign_leads is NULL.');
        continue;
      }
      
      let emailToneData = null;
      if (campaignData.email_tone_id) {
        const { data: tone } = await supabase
          .from('email_tones')
          .select('*')
          .eq('id', campaignData.email_tone_id)
          .single();
        emailToneData = tone;
      }
      
      const engineResult = generateEmail({
        lead: lead,
        campaign: campaignData,
        business: campaignData.businesses,
        emailTone: emailToneData,
        stepIndex: 0,
        totalSteps: 5,
        senderAccount: { name: 'Preview Sender', email: 'preview@example.com' }
      });
      
      console.log('-> Success! Preview Subject:', engineResult.subject);
    } catch (e) {
      console.error('-> Error:', e.message);
    }
  }
}

run().catch(console.error);
