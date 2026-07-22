import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== CHECKING IMPORTED VS ORIGINAL LEADS ===');

  const oldLeadsBackup = JSON.parse(fs.readFileSync('companies/Relay/leads_backup_OLD_Leads.json', 'utf8'));
  const oldBackupIds = new Set(oldLeadsBackup.map(l => l.id));

  const { data: allLeads, error } = await supabase.from('leads').select('id, source, company, created_at');
  if (error) throw error;

  console.log('Total leads in live DB:', allLeads.length);

  let fromOldBackup = 0;
  let originalLeads = 0;

  const oldLeadIdsToDelete = [];

  allLeads.forEach(l => {
    if (oldBackupIds.has(l.id) || l.source === 'Imported Backup') {
      fromOldBackup++;
      oldLeadIdsToDelete.push(l.id);
    } else {
      originalLeads++;
    }
  });

  console.log(`Leads from 18k old backup: ${fromOldBackup}`);
  console.log(`Original curated leads before import: ${originalLeads}`);
}

run().catch(console.error);
