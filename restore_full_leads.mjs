import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== RESTORING LEADS INTO SUPABASE ===');

  const rawLeads = JSON.parse(fs.readFileSync('companies/Relay/leads_backup_OLD_Leads.json', 'utf8'));
  console.log(`Loaded ${rawLeads.length} total raw leads from backup.`);

  // Filter out leads without email or invalid email
  const validLeads = rawLeads.filter(l => l.email && typeof l.email === 'string' && l.email.trim().includes('@'));
  console.log(`Filtered down to ${validLeads.length} valid email contacts.`);

  // 1. Fetch campaigns
  const { data: campaigns, error: cErr } = await supabase.from('campaigns').select('id, name, niche, user_id');
  if (cErr) throw cErr;
  console.log(`Found ${campaigns.length} campaigns in DB.`);

  // 2. Prepare batches of leads for insertion
  const batchSize = 250;
  let insertedLeadsCount = 0;
  let errorCount = 0;

  for (let i = 0; i < validLeads.length; i += batchSize) {
    const batch = validLeads.slice(i, i + batchSize).map(l => ({
      id: l.id,
      user_id: l.user_id || 'c5f44ad2-63d1-43c2-8e17-0333d12e8643',
      email: l.email.trim(),
      name: l.name || null,
      company: l.company || null,
      title: l.title || null,
      phone: l.phone || null,
      linkedin: l.linkedin || null,
      industry: l.industry || null,
      location: l.location || null,
      employees: l.employees || null,
      company_news: l.company_news || null,
      personalized_email: l.personalized_email || null,
      summary: l.summary || '',
      website: l.website || null,
      facebook: l.facebook || '',
      twitter: l.twitter || '',
      instagram: l.instagram || '',
      created_at: l.created_at || new Date().toISOString(),
      validation_status: l.validation_status || 'idle',
      validation_details: l.validation_details || null,
      updated_at: l.updated_at || new Date().toISOString(),
      role: l.role || '',
      source: l.source || 'Imported Backup',
      status: l.status || 'new',
      personalized_subject: l.personalized_subject || null
    }));

    const { error } = await supabase.from('leads').upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      console.error(`Error inserting batch ${i} - ${i + batch.length}:`, error.message);
      errorCount++;
    } else {
      insertedLeadsCount += batch.length;
      if ((i + batch.length) % 1000 < batchSize || i + batch.length >= validLeads.length) {
        console.log(`Progress: ${Math.min(i + batchSize, validLeads.length)} / ${validLeads.length} leads restored...`);
      }
    }
  }

  console.log(`\n✅ Finished importing leads. Successfully processed: ${insertedLeadsCount}, Errors: ${errorCount}`);

  // 3. Assign leads to campaigns
  console.log('\n=== RE-ASSIGNING LEADS TO CAMPAIGN_LEADS ===');

  // Fetch all leads from DB in chunks
  let allDbLeads = [];
  let start = 0;
  const fetchLimit = 1000;
  while (true) {
    const { data: chunk, error } = await supabase
      .from('leads')
      .select('id, company, industry, summary, location, email')
      .range(start, start + fetchLimit - 1);
    if (error || !chunk || chunk.length === 0) break;
    allDbLeads = allDbLeads.concat(chunk);
    if (chunk.length < fetchLimit) break;
    start += fetchLimit;
  }
  console.log(`Total leads in DB to evaluate for campaign assignment: ${allDbLeads.length}`);

  // Map each campaign target buckets
  const campaignBuckets = campaigns.map(c => ({
    id: c.id,
    name: c.name,
    niche: (c.niche || '').toLowerCase(),
    nameLower: c.name.toLowerCase(),
    leadIds: []
  }));

  // Distribute leads evenly across campaigns so each gets 2,000+ leads
  allDbLeads.forEach((lead, idx) => {
    const targetBucket = campaignBuckets[idx % campaignBuckets.length];
    targetBucket.leadIds.push(lead.id);
  });

  // Bulk upsert into campaign_leads for each campaign
  for (const b of campaignBuckets) {
    console.log(`Upserting ${b.leadIds.length} campaign_leads for "${b.name}"...`);
    const clBatchSize = 500;
    for (let j = 0; j < b.leadIds.length; j += clBatchSize) {
      const clBatch = b.leadIds.slice(j, j + clBatchSize).map(leadId => ({
        campaign_id: b.id,
        lead_id: leadId
      }));

      const { error: clErr } = await supabase.from('campaign_leads').upsert(clBatch, { onConflict: 'campaign_id,lead_id' });
      if (clErr) {
        console.error(`Error linking campaign_leads for ${b.name}:`, clErr.message);
      }
    }

    // Get exact count in campaign_leads
    const { count: finalCount } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', b.id);

    // Update campaign prospects column
    await supabase.from('campaigns').update({ prospects: finalCount }).eq('id', b.id);
    console.log(`✅ Updated Campaign "${b.name}": ${finalCount} prospects`);
  }

  console.log('\n🚀 RESTORATION COMPLETE!');
}

run().catch(console.error);
