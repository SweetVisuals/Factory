import dotenv from 'dotenv';
import { generateEmail } from './companies/Relay/server/email_engine.mjs';

dotenv.config({ path: 'companies/Relay/.env' });

function testTemplate() {
  console.log('=== TESTING OUTREACH EMAIL TEMPLATE OUTPUT ===\n');

  const testCases = [
    {
      name: 'Anthony Smith',
      company: 'JBT Renovations Ltd',
      summary: '## ⚡ Personalised Detail\nreclaimed two-storey extension with salvaged brickwork\n\n## 🔬 Quick Fact\nBased in Falkirk with 15 years experience.'
    },
    {
      name: null,
      company: 'Highland Stonemasonry Ltd',
      summary: '## ⚡ Personalised Detail\nsandstone restoration and dry stone walling\n\n## 🔬 Quick Fact\nHeritage restoration specialists in Scotland.'
    },
    {
      name: 'Dave Wilson',
      company: 'Cornerstone Builders',
      summary: '' // No research -> fallback 'work'
    }
  ];

  for (const lead of testCases) {
    const email = generateEmail({
      lead,
      campaign: { niche: 'Building Contractors' },
      stepIndex: 0
    });

    console.log(`\n=================== LEAD: ${lead.name || lead.company} ===================`);
    console.log('SUBJECT:', email.subject);
    console.log('----------------------------------------------------------------');
    console.log(email.body);
    console.log('================================================================');
  }
}

testTemplate();
