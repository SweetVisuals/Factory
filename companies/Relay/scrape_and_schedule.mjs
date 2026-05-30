import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData) { console.log('Auth failed'); return; }

  const token = authData.session.access_token;
  
  const { data: campaigns } = await supabase.from('campaigns').select('*');
  const campMap = {};
  campaigns.forEach(c => { campMap[c.name] = c.id; });
  
  console.log('Active campaigns:');
  Object.entries(campMap).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  // Trigger scraping for Roofing and E-commerce
  // Also generate email sequences for campaigns that have leads
  
  const scraperUrl = 'http://localhost:3001/api/scrape-leads';
  
  // 1. Roofing - scrape 20 leads
  console.log('\n1. Triggering Roofing scrape...');
  const roofResp = await fetch(scraperUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      business: 'roofing contractors',
      location: 'United States',
      limit: 20,
      campaignId: campMap['Roofing Contractors - US'],
      keywords: 'roofing contractor residential commercial roof repair installation'
    })
  });
  const roofJson = await roofResp.json();
  console.log(`  Response: ${roofResp.status} ${JSON.stringify(roofJson).substring(0, 200)}`);
  
  // 2. E-commerce - scrape 20 leads
  console.log('\n2. Triggering E-commerce scrape...');
  const ecomResp = await fetch(scraperUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      business: 'ecommerce stores',
      location: 'United States',
      limit: 20,
      campaignId: campMap['E-commerce Stores'],
      keywords: 'online store shopify ecommerce fashion retail'
    })
  });
  const ecomJson = await ecomResp.json();
  console.log(`  Response: ${ecomResp.status} ${JSON.stringify(ecomJson).substring(0, 200)}`);
  
  // 3. Generate sequences for campaigns that have leads
  console.log('\n3. Generating email sequences...');
  
  const seqUrl = 'http://localhost:3001/api/generate-sequences';
  
  const sequenceCampaigns = [
    { name: 'Legal Services - UK', niche: 'Legal Services', company: 'Relay Solutions' },
    { name: 'Law Firm Cybersecurity Compliance', niche: 'Legal Services Cybersecurity', company: 'Relay Solutions', pitch: 'Cybersecurity compliance services for law firms' },
    { name: 'Cybersecurity Compliance', niche: 'Cybersecurity Compliance', company: 'Relay Solutions', pitch: 'Comprehensive cybersecurity compliance solutions' }
  ];
  
  for (const sc of sequenceCampaigns) {
    console.log(`  Generating for "${sc.name}"...`);
    
    // Need campaignId
    const campaignId = campMap[sc.name];
    
    const seqResp = await fetch(seqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        campaignName: sc.name,
        niche: sc.niche,
        company: sc.company,
        pitch: sc.pitch || '',
        count: 5
      })
    });
    const seqJson = await seqResp.json();
    if (seqJson.success) {
      console.log(`  ✅ Generated ${seqJson.data?.length || 0} sequences`);
      // Save sequences
      if (seqJson.data && seqJson.data.length > 0) {
        // Try saving to a sequences table
        for (const seq of seqJson.data) {
          const { error: se } = await supabase.from('email_templates').upsert({
            campaign_id: campaignId,
            name: seq.name,
            subject: seq.subject,
            content: seq.content,
            step_order: parseInt(seq.name?.match(/\\d+/)?.[0] || '1')
          });
          if (se) {
            // Try creating a templates record
            const { error: se2 } = await supabase.from('templates').upsert({
              campaign_id: campaignId,
              name: seq.name,
              subject: seq.subject,
              content: seq.content
            });
            if (se2) {
              console.log(`    Save error: ${se2.message}`);
            }
          }
        }
        console.log(`    Sample subject: "${seqJson.data[0]?.subject || 'N/A'}"`);
      }
    } else {
      console.log(`  ❌ Error: ${seqJson.error || 'Failed'}`);
    }
  }
}

main().catch(console.error);
