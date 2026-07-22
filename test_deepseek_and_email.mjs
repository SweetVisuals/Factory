import dotenv from 'dotenv';
import { fetchAIChatCompletion } from './companies/Relay/server/ai-client.mjs';
import { researchAndSummarizeLead } from './companies/Relay/server/research_helper.mjs';
import { generateEmail } from './companies/Relay/server/email_engine.mjs';

dotenv.config({ path: 'companies/Relay/.env' });

async function runTest() {
  console.log('=== TESTING DEEPSEEK API & OUTREACH GUIDE EMAIL ENGINE ===\n');

  // 1. Test AI Client API
  console.log('1. Testing AI Client with DeepSeek API key...');
  try {
    const aiRes = await fetchAIChatCompletion({
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
      max_tokens: 20
    });
    console.log('  DeepSeek Response:', aiRes.choices[0].message.content.trim());
  } catch (e) {
    console.error('  AI Client Error:', e.message);
  }

  // 2. Test Research Helper
  console.log('\n2. Testing Research Helper (Anti-Hallucination & Detail Extraction)...');
  const sampleLead = {
    name: 'Anthony Smith',
    company: 'JBT Renovations Ltd',
    website: 'https://jbtrenovations.co.uk',
    location: 'Falkirk, UK',
    summary: ''
  };

  const researchRes = await researchAndSummarizeLead(sampleLead, console.log);
  console.log('  Research Result:\n', researchRes.summary);

  // 3. Test Email Generation with Locked Template
  console.log('\n3. Testing Email Generation against Personalised_Outreach_Email_Guide.md...');
  sampleLead.summary = researchRes.summary;

  const email = generateEmail({
    lead: sampleLead,
    campaign: { niche: 'Building Contractors' },
    stepIndex: 0
  });

  console.log('\n------------------- GENERATED OUTREACH EMAIL -------------------');
  console.log('SUBJECT:', email.subject);
  console.log('----------------------------------------------------------------');
  console.log(email.body);
  console.log('----------------------------------------------------------------');
}

runTest().catch(console.error);
