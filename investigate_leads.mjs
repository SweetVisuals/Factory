import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== INVESTIGATING LEADS ===');

  // 1. Fetch campaigns
  const { data: campaigns, error: cErr } = await supabase.from('campaigns').select('*');
  console.log('Campaigns count:', campaigns?.length);
  for (const c of (campaigns || [])) {
    const { count: clCount } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', c.id);

    console.log(`Campaign: "${c.name}" (ID: ${c.id})`);
    console.log(`  DB prospects column: ${c.prospects}`);
    console.log(`  Actual campaign_leads count: ${clCount}`);
    console.log(`  Business ID: ${c.business_id}, User ID: ${c.user_id}, Status: ${c.status}`);
  }

  // 2. Check total counts in tables
  const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true });
  const { count: totalCampaignLeads } = await supabase.from('campaign_leads').select('*', { count: 'exact', head: true });
  const { count: totalListLeads } = await supabase.from('list_leads').select('*', { count: 'exact', head: true });
  const { count: totalSavedLists } = await supabase.from('saved_lists').select('*', { count: 'exact', head: true });

  console.log('\n=== TOTAL TABLE COUNTS ===');
  console.log('Total leads table:', totalLeads);
  console.log('Total campaign_leads table:', totalCampaignLeads);
  console.log('Total list_leads table:', totalListLeads);
  console.log('Total saved_lists table:', totalSavedLists);

  // 3. Check status breakdown in campaign_leads
  const { data: clStatuses } = await supabase.from('campaign_leads').select('status');
  const statusMap = {};
  (clStatuses || []).forEach(s => {
    statusMap[s.status] = (statusMap[s.status] || 0) + 1;
  });
  console.log('\n=== CAMPAIGN_LEADS STATUS BREAKDOWN ===', statusMap);

  // 4. Check backup files size and count
  const backupFiles = ['companies/Relay/leads_backup.json', 'companies/Relay/leads_backup_OLD_Leads.json'];
  for (const bf of backupFiles) {
    if (fs.existsSync(bf)) {
      const stats = fs.statSync(bf);
      console.log(`Backup file ${bf}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      try {
        const content = JSON.parse(fs.readFileSync(bf, 'utf8'));
        console.log(`  Item count in ${bf}:`, Array.isArray(content) ? content.length : 'not an array');
      } catch (e) {
        console.log(`  Could not parse ${bf}:`, e.message);
      }
    }
  }

  // 5. Check if there are migration chunks or SQL files with leads
  const files = fs.readdirSync('c:/Users/Shadow/Desktop/Factory');
  const sqlChunks = files.filter(f => f.includes('migration') || f.includes('leads'));
  console.log('\n=== SQL CHUNKS / BACKUP FILES IN FACTORY ===', sqlChunks);
}

run().catch(console.error);
