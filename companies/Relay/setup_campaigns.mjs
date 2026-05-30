import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function query(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // Try direct REST query for SELECT
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      // Use supabase JS client fallback
    }
    return { error };
  }
  return { data };
}

async function setup() {
  const userId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
  
  // Check if campaigns table exists and what columns it has
  let { data: cols, error: ce } = await supabase.from('campaigns').select('*').limit(1);
  if (ce && ce.message.includes('does not exist')) {
    console.log('Campaigns table does not exist. Need to create schema first.');
    console.log('Error:', ce.message);
    return;
  }
  
  console.log('Campaign table exists. Checking columns...');
  if (cols && cols.length > 0) {
    console.log('Columns:', Object.keys(cols[0]).join(', '));
  } else {
    console.log('Campaign table is empty. Will get schema from type info...');
  }

  // Try to get the table schema from supabase metadata
  let { data: schemaInfo } = await supabase
    .from('campaigns')
    .select();
  
  console.log('Sample:', JSON.stringify(schemaInfo));
  
  // Try INSERT via REST to understand required columns
  // Create campaigns directly
  const campaigns = [
    {
      name: 'Roofing Contractors',
      niche: 'Roofing',
      objective: 'Find roofing contractors in the US for outreach regarding marketing services',
      status: 'Draft',
      prospects: 0,
      replies: 0,
      replyRate: '0%',
      location: 'United States',
      user_id: userId
    },
    {
      name: 'Legal Services - UK',
      niche: 'Legal Services',
      objective: 'Connect with UK law firms to pitch compliance and cybersecurity services',
      status: 'Draft',
      prospects: 0,
      replies: 0,
      replyRate: '0%',
      location: 'United Kingdom',
      user_id: userId
    },
    {
      name: 'Cybersecurity for Law Firms',
      niche: 'Cybersecurity Compliance',
      objective: 'Sell cybersecurity compliance services to law firms across the US',
      status: 'Draft',
      prospects: 0,
      replies: 0,
      replyRate: '0%',
      location: 'United States',
      user_id: userId
    },
    {
      name: 'E-commerce Businesses',
      niche: 'E-commerce',
      objective: 'Find e-commerce stores needing lead generation and marketing automation',
      status: 'Draft',
      prospects: 0,
      replies: 0,
      replyRate: '0%',
      location: 'United States',
      user_id: userId
    },
    {
      name: 'Real Estate Agents',
      niche: 'Real Estate',
      objective: 'Outreach to real estate agents offering digital marketing and automation tools',
      status: 'Draft',
      prospects: 0,
      replies: 0,
      replyRate: '0%',
      location: 'United States',
      user_id: userId
    }
  ];

  for (const campaign of campaigns) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(campaign)
      .select();
    
    if (error) {
      console.log(`Error creating "${campaign.name}":`, error.message);
      // Try with fewer fields
      const minimal = {
        name: campaign.name,
        user_id: userId
      };
      const { data: d2, error: e2 } = await supabase
        .from('campaigns')
        .insert(minimal)
        .select();
      if (e2) console.log(`  Minimal insert also failed:`, e2.message);
      else console.log(`  Created "${campaign.name}" (minimal):`, d2[0].id);
    } else {
      console.log(`Created campaign "${campaign.name}":`, data[0].id);
    }
  }
}

setup().catch(console.error);
