import fs from 'fs';

async function run() {
  console.log('=== CHECKING BACKUP FILES & DATA ===');

  if (fs.existsSync('companies/Relay/leads_backup_OLD_Leads.json')) {
    const oldLeads = JSON.parse(fs.readFileSync('companies/Relay/leads_backup_OLD_Leads.json', 'utf8'));
    console.log('OLD Leads count:', oldLeads.length);
    if (oldLeads.length > 0) {
      console.log('Sample OLD Lead:', oldLeads[0]);
    }
  }

  if (fs.existsSync('relay_migration_data.json')) {
    const migData = JSON.parse(fs.readFileSync('relay_migration_data.json', 'utf8'));
    console.log('relay_migration_data.json keys:', Object.keys(migData));
    if (migData.leads) console.log('  leads in migration data:', migData.leads.length);
    if (migData.campaign_leads) console.log('  campaign_leads in migration data:', migData.campaign_leads.length);
    if (migData.campaigns) console.log('  campaigns in migration data:', migData.campaigns.length);
  }
}

run().catch(console.error);
