import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateEmail } from '../companies/Relay/server/email_engine.mjs';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// We need to simulate or call generateAndSaveSequencesForCampaign using DeepSeek.
// Since it's in index.mjs, we can write a script that does the same DeepSeek generation, or calls index.mjs's internal generator.
// Let's write the fetchAIChatCompletion logic using DeepSeek directly in this script.

async function fetchAIChatCompletion(payload) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} - ${await response.text()}`);
  }
  return await response.json();
}

async function run() {
  const campaignName = "Creative Agencies (UK)";
  
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('*, businesses(*)')
    .eq('name', campaignName)
    .single();
    
  if (campErr || !campaign) {
    console.error('Campaign not found:', campaignName);
    return;
  }
  
  console.log(`Regenerating templates and schedules for "${campaignName}" using DeepSeek...`);
  
  // 1. Delete existing schedules for this campaign
  console.log('-> Deleting existing scheduled_emails...');
  await supabase
    .from('scheduled_emails')
    .delete()
    .eq('campaign_id', campaign.id);
    
  // 2. Delete existing templates for this campaign
  console.log('-> Deleting existing templates...');
  await supabase
    .from('templates')
    .delete()
    .eq('campaign_id', campaign.id);
    
  // 3. Generate templates using DeepSeek
  console.log('-> Calling DeepSeek for 5-step sequence...');
  const niche = campaign.niche || 'General Business';
  const company = campaign.company_name || 'Our Company';
  const pitch = campaign.pitch || campaign.objective || '';
  
  const pitchContext = pitch ? `
Your Pitch / Service Offering: "${pitch}"
This is the specific product or service being offered. Every email must feel like it was written specifically around this offering — the value, the angle, the curiosity — all tied to what you do. Do NOT be generic.` : '';

  const systemPrompt = `You are an elite B2B cold email copywriter. You write like a real human, not a marketing department.
Every email must feel like it came from someone who genuinely understands the recipient's industry — not someone blasting a mass list.${pitchContext}

STRICT PLACEHOLDER DICTIONARY:
You MUST use these exact placeholders: [LEAD FIRST NAME], [LEAD COMPANY], [MY COMPANY], [PERSONALISED DETAIL], [INDUSTRY]

ABSOLUTE RULES (violation = failure):
1. GREETING: Always "Hi [LEAD FIRST NAME]," — NEVER full name, NEVER last name.
2. NEVER mention the lead's job title, role, or position anywhere.
3. BANNED PHRASES: "sounds interesting", "I hope this finds you well", "I wanted to reach out", "touch base", "circling back".
4. SUBJECT LINES: no placeholders, under 9 words.
5. NO SIGN-OFF in the body.

Output Format: JSON object with a "sequences" array of EXACTLY 5 objects.
Each object MUST have EXACTLY these 3 keys:
- "name": Step title (e.g. "Step 1: The Pattern Interrupt")
- "subject": The email subject line (no placeholders, under 9 words)
- "content": The full email body — greeting included, NO sign-off, NO signature`;

  const userPrompt = `Generate a 5-step cold outreach sequence for the "${niche}" niche.`;
  const contextPrompt = `
Our company is "${company}". Use [MY COMPANY] to represent our company name in the templates.${pitch ? `
We are specifically pitching: "${pitch}". Every email angle, hook, and value proposition must be grounded in THIS specific offering — not a generic version of it.` : ''}
The tone should feel like a genuinely helpful person reaching out — curious, concise, and human.
Use [PERSONALISED DETAIL] as the anchor for personalisation. Do NOT invent specific facts.
Do NOT mention the lead's role or job title anywhere in the emails.
Each email MUST be completely different in topic and approach — no repetition across steps.

SUBJECT LINE REQUIREMENT: Each subject line must be sharply niche-specific to "${niche}".`;

  const responseJson = await fetchAIChatCompletion({
    model: 'deepseek-chat',
    temperature: 1.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt + contextPrompt }
    ],
    response_format: { type: 'json_object' }
  });
  
  const contentString = responseJson.choices[0].message.content;
  const content = JSON.parse(contentString);
  let sequences = Array.isArray(content) ? content : (content.sequences || content.emails);
  if (!sequences && typeof content === 'object') {
    const firstArrayKey = Object.keys(content).find(key => Array.isArray(content[key]));
    if (firstArrayKey) sequences = content[firstArrayKey];
  }
  
  sequences = sequences || [];
  console.log(`-> Generated ${sequences.length} templates via DeepSeek.`);
  
  // 4. Save templates
  const savedTemplates = [];
  for (let i = 0; i < sequences.length; i++) {
    const step = sequences[i];
    const { data: tpl } = await supabase
      .from('templates')
      .insert({
        campaign_id: campaign.id,
        name: step.name || `Step ${i + 1}`,
        subject: step.subject || '',
        content: step.content || ''
      })
      .select()
      .single();
    savedTemplates.push(tpl);
  }
  
  // 5. Generate schedules
  const startDate = new Date();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const defaultEmailAccountId = 'd87152f1-6c2a-4362-be9d-539050fd07e7';
  
  for (const tpl of savedTemplates) {
    console.log(`-> Scheduling template "${tpl.name}"...`);
    const { data: scheduleData } = await supabase
      .from('scheduled_emails')
      .insert({
        campaign_id: campaign.id,
        template_id: tpl.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        scheduled_for: startDate.toISOString(),
        total_emails: 100,
        interval_minutes: 15,
        emails_per_account: 500,
        status: 'paused'
      })
      .select()
      .single();
      
    await supabase
      .from('schedule_email_accounts')
      .insert({
        schedule_id: scheduleData.id,
        email_account_id: defaultEmailAccountId,
        emails_sent: 0,
        emails_remaining: 500
      });
  }
  
  // 6. Set status to review
  await supabase
    .from('campaigns')
    .update({ status: 'review' })
    .eq('id', campaign.id);
    
  console.log(`✅ Campaign "${campaignName}" successfully regenerated using DeepSeek!`);
}

run().catch(console.error);
