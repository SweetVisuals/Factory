import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  // Authenticate
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  
  if (authError) {
    console.log('Auth error:', authError.message);
    return;
  }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });
  
  // 1. Get all leads
  const { data: leads } = await client.from('leads').select('*');
  console.log(`Total leads: ${leads?.length || 0}`);
  
  // 2. Categorize leads by industry/source/company name
  const roofing = [];
  const legal = [];
  const cybersecurity = [];
  const ecommerce = [];
  const realestate = [];
  const other = [];
  
  const roofKeywords = ['roof', 'roofing', 'shingle', 'gutter', 'siding'];
  const legalKeywords = ['law', 'solicitor', 'attorney', 'legal', 'lawyer', 'counsel', 'firm', 'llp', 'solicitors', 'advocate', 'barrister', 'litigation'];
  const cyberKeywords = ['cyber', 'security', 'compliance', 'IT', 'technology', 'tech', 'software', 'data', 'information', 'infosec', 'digital'];
  const ecomKeywords = ['shop', 'store', 'retail', 'ecommerce', 'e-commerce', 'fashion', 'apparel', 'beauty', 'lash', 'cosmetic', 'brand'];
  const realEstateKeywords = ['real estate', 'property', 'realtor', 'agent', 'mortgage', 'apartment', 'rental', 'housing', 'estate'];
  
  for (const lead of leads) {
    const c = (lead.company || '').toLowerCase();
    const ind = (lead.industry || '').toLowerCase();
    const searchText = c + ' ' + ind;
    
    if (roofKeywords.some(k => searchText.includes(k))) {
      roofing.push(lead);
    } else if (legalKeywords.some(k => searchText.includes(k))) {
      legal.push(lead);
    } else if (cyberKeywords.some(k => searchText.includes(k))) {
      cybersecurity.push(lead);
    } else if (ecomKeywords.some(k => searchText.includes(k))) {
      ecommerce.push(lead);
    } else if (realEstateKeywords.some(k => searchText.includes(k))) {
      realestate.push(lead);
    } else {
      other.push(lead);
    }
  }
  
  console.log(`Roofing: ${roofing.length}`);
  console.log(`Legal: ${legal.length}`);
  console.log(`Cybersecurity: ${cybersecurity.length}`);
  console.log(`E-commerce: ${ecommerce.length}`);
  console.log(`Real Estate: ${realestate.length}`);
  console.log(`Other (uncategorized): ${other.length}`);
  
  if (other.length > 0) {
    console.log('\nUncategorized leads:');
    other.slice(0, 10).forEach(l => console.log(`  ${l.company}`));
  }
  
  // 3. Get campaigns
  const { data: campaigns } = await client.from('campaigns').select('*');
  
  if (campaigns) {
    console.log('\nAll campaigns:');
    campaigns.forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.status}`));
  }
  
  // Store for assignment
  console.log('\n--- CAMPAIGN ID MAP ---');
  console.log(`ROOFING: "${roofing[0]?.id || '(sample id)'}"`);
  console.log(`LEGAL: ${legal.length} leads`);
  console.log(`CYBERSECURITY: ${cybersecurity.length} leads`);
  console.log(`ECOMMERCE: ${ecommerce.length} leads`);
  console.log(`REALESTATE: ${realestate.length} leads`);
  console.log(`OTHER: ${other.length} leads`);
}

main().catch(console.error);
