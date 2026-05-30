import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  
  if (authError) { console.log('Auth error:', authError.message); return; }
  
  const headers = { Authorization: `Bearer ${authData.session.access_token}` };
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { global: { headers } });

  // Get all campaigns
  const { data: campaigns } = await client.from('campaigns').select('*');
  const campMap = {};
  campaigns.forEach(c => { campMap[c.name] = c.id; });
  console.log('Campaign map:', JSON.stringify(campMap, null, 2));

  // Get all leads
  const { data: leads } = await client.from('leads').select('*');
  console.log(`\nTotal leads: ${leads.length}`);

  // Categorize leads
  function categorize(company, industry) {
    const c = (company || '').toLowerCase();
    const searchText = c + ' ' + (industry || '').toLowerCase();
    
    const roofKeywords = ['roof', 'roofing', 'shingle', 'gutter', 'siding'];
    const cyberKeywords = ['cyber', 'security', 'compliance', 'infosec', 'IT security'];
    const ecomKeywords = ['shop', 'store', 'retail', 'ecommerce', 'fashion', 'apparel', 'beauty', 'cosmetic'];
    const realEstateKeywords = ['real estate', 'property', 'realtor', 'mortgage', 'rental'];
    
    // Most of our leads are legal
    // Let's just differentiate: legal vs cyber vs other
    if (cyberKeywords.some(k => searchText.includes(k))) return 'cyber';
    return 'legal'; // everything else is legal for now
  }

  // A. "Legal Services - UK": UK-based law firms
  const legalUKId = campMap['Legal Services - UK'];
  const legalUSAId = campMap['Law Firm Cybersecurity Compliance'];
  const cyberId = campMap['Cybersecurity Compliance'];
  
  // Check campaign_leads table exists
  const { data: clTest } = await client.from('campaign_leads').select('*').limit(1);
  if (!clTest) {
    console.log('campaign_leads table not accessible, trying alternative...');
  }

  // Try updating leads with campaign_id directly
  let ukCount = 0, usCount = 0, cyberCount = 0;
  
  for (const lead of leads) {
    const cat = categorize(lead.company, lead.industry);
    let targetCampaignId;
    
    if (cat === 'cyber') {
      targetCampaignId = cyberId;
      cyberCount++;
    } else {
      const location = (lead.location || '').toLowerCase();
      if (location.includes('uk') || location.includes('london') || location.includes('england') || location.includes('united kingdom')) {
        targetCampaignId = legalUKId;
        ukCount++;
      } else {
        targetCampaignId = legalUSAId;
        usCount++;
      }
    }
    
    // Update lead with campaign_id
    const { error: ue } = await client.from('campaigns_leads').upsert({
      campaign_id: targetCampaignId,
      lead_id: lead.id
    }, { onConflict: 'campaign_id,lead_id' });
    
    if (ue) {
      // Try other table
      const { error: ue2 } = await client.from('lead_campaigns').upsert({
        campaign_id: targetCampaignId,
        lead_id: lead.id
      }, { onConflict: 'campaign_id,lead_id' });
      
      if (ue2) {
        // Just log the first few errors
        if (cyberCount + ukCount + usCount < 5) {
          console.log(`Error linking ${lead.company}:`, ue2.message);
        }
      }
    }
  }
  
  console.log(`\nCategorized: UK Legal=${ukCount}, US Legal=${usCount}, Cyber=${cyberCount}`);
  
  // Check if we can update leads directly with campaign_id
  const { data: leadCols } = await client.from('leads').select('*').limit(1);
  if (leadCols && leadCols[0]) {
    console.log('\nLead columns:', Object.keys(leadCols[0]).join(', '));
    
    // If leads have a campaign_id column, use that
    if ('campaign_id' in leadCols[0]) {
      console.log('campaign_id column exists in leads! Updating directly...');
      
      ukCount = 0; usCount = 0; cyberCount = 0;
      for (const lead of leads) {
        const cat = categorize(lead.company, lead.industry);
        let targetCampaignId;
        
        if (cat === 'cyber') {
          targetCampaignId = cyberId;
          cyberCount++;
        } else {
          const location = (lead.location || '').toLowerCase();
          if (location.includes('uk') || location.includes('london') || location.includes('england') || location.includes('united kingdom')) {
            targetCampaignId = legalUKId;
            ukCount++;
          } else {
            targetCampaignId = legalUSAId;
            usCount++;
          }
        }
        
        const { error: ue } = await client.from('leads')
          .update({ campaign_id: targetCampaignId })
          .eq('id', lead.id);
        
        if (ue && usCount + ukCount + cyberCount < 5) {
          console.log(`Direct update error for ${lead.company}:`, ue.message);
        }
      }
      console.log(`\nDirect update: UK Legal=${ukCount}, US Legal=${usCount}, Cyber=${cyberCount}`);
      
      // Now count assigned
      const { count: assigned } = await client.from('leads').select('*', { count: 'exact', head: true }).neq('campaign_id', null);
      console.log(`Total assigned leads: ${assigned}`);
    }
  }
}

main().catch(console.error);
