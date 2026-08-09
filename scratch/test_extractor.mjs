import { researchAndSummarizeLead } from '../companies/Relay/server/research_helper.mjs';

async function testExtractor() {
  const mockLead = {
    id: 'test-123',
    name: 'Test Lead',
    company: 'Apple',
    website: 'https://apple.com',
    industry: 'Technology',
    location: 'Cupertino, CA'
  };

  console.log('Testing extraction for Apple...');
  const result = await researchAndSummarizeLead(mockLead, console.log, 'Test Pitch');
  console.log('\n--- Extraction Result ---');
  console.log(JSON.stringify(result.structured, null, 2));
  console.log('\n--- Summary ---');
  console.log(result.summary);
}

testExtractor().catch(console.error);
