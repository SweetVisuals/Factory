import fs from 'fs';

async function run() {
  console.log('=== ANALYZING OLD LEADS BACKUP (18,649 leads) ===');

  const oldLeads = JSON.parse(fs.readFileSync('companies/Relay/leads_backup_OLD_Leads.json', 'utf8'));
  console.log('Total leads in old backup:', oldLeads.length);

  // Check unique emails
  const emails = new Set();
  let validEmails = 0;
  oldLeads.forEach(l => {
    if (l.email && l.email.trim() && l.email.includes('@')) {
      validEmails++;
      emails.add(l.email.trim().toLowerCase());
    }
  });

  console.log('Leads with valid email string:', validEmails);
  console.log('Unique email addresses:', emails.size);

  // Group by industry / location / role / company keywords to see distribution
  const industries = {};
  const locations = {};

  oldLeads.forEach(l => {
    const ind = l.industry || 'Unknown';
    industries[ind] = (industries[ind] || 0) + 1;

    const loc = l.location || 'Unknown';
    // simplify loc
    let country = 'Other';
    const locLower = loc.toLowerCase();
    if (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london') || locLower.includes('england') || locLower.includes('manchester') || locLower.includes('birmingham') || locLower.includes('sale') || locLower.includes('leeds')) {
      country = 'UK';
    } else if (locLower.includes('us') || locLower.includes('united states') || locLower.includes('ca') || locLower.includes('ny') || locLower.includes('tx') || locLower.includes('fl')) {
      country = 'US';
    }
    locations[country] = (locations[country] || 0) + 1;
  });

  console.log('\nTop Industries sample:', Object.entries(industries).slice(0, 15));
  console.log('\nLocation breakdown:', locations);
}

run().catch(console.error);
