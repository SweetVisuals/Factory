import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const defaultEmailAccountId = 'd87152f1-6c2a-4362-be9d-539050fd07e7'; // relaysolutionsltd@gmail.com

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
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('*, businesses(*)');
    
  if (campErr) {
    console.error('Error fetching campaigns:', campErr);
    return;
  }
  
  console.log(`Starting DeepSeek regeneration for all ${campaigns.length} campaigns...`);
  
  for (const campaign of campaigns) {
    if (!campaign.business_id) {
      console.log(`Campaign "${campaign.name}" has no business assigned. Skipping.`);
      continue;
    }
    console.log(`\n--------------------------------------------`);
    console.log(`Regenerating campaign: "${campaign.name}"...`);
    
    // 1. Delete existing schedules for this campaign
    console.log('-> Clearing existing scheduled_emails...');
    await supabase
      .from('scheduled_emails')
      .delete()
      .eq('campaign_id', campaign.id);
      
    // 2. Delete existing templates for this campaign
    console.log('-> Clearing existing templates...');
    await supabase
      .from('templates')
      .delete()
      .eq('campaign_id', campaign.id);
      
    // 3. Ensure email account linkage
    const { data: linkedAccounts } = await supabase
      .from('campaign_email_accounts')
      .select('email_account_id')
      .eq('campaign_id', campaign.id);
      
    let emailAccountIds = (linkedAccounts || []).map(a => a.email_account_id);
    if (emailAccountIds.length === 0) {
      console.log(`-> Linking default email account: ${defaultEmailAccountId}`);
      await supabase
        .from('campaign_email_accounts')
        .insert({
          campaign_id: campaign.id,
          email_account_id: defaultEmailAccountId
        });
      emailAccountIds = [defaultEmailAccountId];
    }
    
    // 4. Fetch writing tone content
    let emailToneContent = '';
    if (campaign.email_tone_id) {
      const { data: tone } = await supabase
        .from('email_tones')
        .select('content_md')
        .eq('id', campaign.email_tone_id)
        .single();
      if (tone) {
        emailToneContent = tone.content_md || '';
      }
    }
    
    // 5. Generate templates using DeepSeek
    console.log('-> Generating 5-step sequence templates using DeepSeek...');
    const niche = campaign.niche || 'General Business';
    const company = campaign.company_name || 'Our Company';
    const pitch = campaign.pitch || campaign.objective || '';
    const businessOverview = campaign.businesses?.overview_md || '';
    
    const pitchContext = pitch ? `
Your Pitch / Service Offering: "${pitch}"
This is the specific product or service being offered. Every email must feel like it was written specifically around this offering — the value, the angle, the curiosity — all tied to what you do. Do NOT be generic.` : '';

    const businessPrompt = businessOverview ? `\n\nOUR BUSINESS OVERVIEW:\n${businessOverview}\n` : '';
    const tonePrompt = emailToneContent ? `\n\nWRITING TONE AND STYLE RULES:\n${emailToneContent}\n` : '';

    const systemPrompt = `You are an elite B2B cold email copywriter. You write like a real human, not a marketing department.
Every email must feel like it came from someone who genuinely understands the recipient's industry — not someone blasting a mass list.${pitchContext}${businessPrompt}${tonePrompt}
(Note: the current year is 2026. Make sure any temporal, case study, or date references reflect this).

TONE & STYLE:
- Write in a slightly humorous and playful tone, but keep it business-oriented and results-driven.
- Keep it short, direct, and straight to the point. No fluff, no generic opening lines.
- Avoid dry corporate jargon or sounding too statistical (do not load the emails with numbers/statistics unless necessary).
- The word "bid" is strictly banned. Do not use the word "bid" or variations (e.g., project bid, bidding) under any circumstances.
- SEQUENCE EVOLUTION: The sequence must evolve. Step 1 must always focus on building rapport and starting a conversation (establishing connection). Subsequent steps pick up the pace and follow up more directly.

STRICT PLACEHOLDER DICTIONARY:
You MUST use these exact placeholders whenever referring to dynamic data: [LEAD FIRST NAME], [LEAD COMPANY], [MY COMPANY], [PERSONALISED DETAIL], [INDUSTRY]

ABSOLUTE RULES (violation = failure):
1. GREETING: Always "Hi [LEAD FIRST NAME]," — NEVER full name, NEVER last name.
2. NEVER mention the lead's job title, role, or position anywhere.
3. BANNED PHRASES & WORDS — never use any of these under any circumstances:
   "bid", "sounds interesting", "I thought it was interesting", "I found it interesting",
   "I hope this finds you well", "I wanted to reach out", "touch base", "I came across your website",
   "I noticed you", "just checking in", "circling back", "synergy", "leverage", "unlock potential", "game-changer".
4. SUBJECT LINES — critically important:
   a. NEVER use placeholders in the subject line (e.g. no [LEAD FIRST NAME] or [LEAD COMPANY]).
   b. Each subject must feel completely different in format and approach.
   c. Niche-specific and intriguing — a busy decision-maker must WANT to open it.
   d. Under 9 words. Sentence-case only.
   e. BANNED subject styles: "Quick question", "Following up", "Checking in", "Touching base", "Partnership opportunity".
   f. Mix formats across the 5 steps: bold statement, provocative question, insight teaser, personal check-in, graceful exit.
5. DO NOT INCLUDE ANY SIGN-OFF, "Best,", "Regards,", or any closing in the body. The system auto-appends the signature.
6. Plain text only. No HTML. Normal line breaks between paragraphs.
7. Each step MUST cover a completely unique angle — no repeated topics, features, or ideas across steps.
8. SPECIFIC USE CASES & SOLUTIONS: Describe a highly concrete, realistic custom solution tailored specifically to the targeted niche. Show them EXACTLY what we can do for them, derived entirely from the provided Pitch / Service Offering. Do NOT invent random services.
9. NEVER SELL OR PITCH DIRECTLY. Your ONLY goal is to book a calendar slot or phone call by enquiring about their current struggles and hurdles. DO NOT offer a solution immediately. Be genuinely curious.

STEP ARCHETYPES — follow each one precisely:

Step 1 — "The Rapport Starter":
This is the first touch. Focus entirely on building rapport and starting a conversation.
- Sound like a real, helpful human. Start with a light, slightly playful or humorous connection point relevant to [INDUSTRY] or their world.
- Do NOT pitch anything here. The ONLY goal is connection and starting a conversation.
- Use [PERSONALISED DETAIL] naturally if it anchors the opener.
- Keep it under 50 words total.

Step 2 — "Picking Up the Pace":
They've seen you once — now pick up the pace and follow up more directly.
- Pivot to showing value and introducing your offering/solution in a playful, results-driven way.
- Frame your custom solution to their industry pain points.
- Keep it short, direct, and under 55 words.

Step 3 — "The Social Proof Story":
- Reference a concrete outcome, result, or scenario relevant to someone in the [INDUSTRY] space.
- Tell a brief, results-oriented, playful story. No dry stats.
- Low-friction CTA: "Worth a quick chat?" or similar.
- Under 60 words.

Step 4 — "The Short Check-in":
Super short, direct, and human.
- Acknowledge time has passed. One sentence. One question.
- Under 35 words.

Step 5 — "The Breakup / Closing":
Polite, direct exit. Leave the door open warmly.
- Frame the exit with a closing phrase like: "no worries, or is it okay if we contact you again in a few months if anything changed?"
- Keep it under 40 words.

Output Format: You MUST return a json object with a "sequences" array of EXACTLY 5 objects.
Each object MUST have EXACTLY these 3 keys:
- "name": Step title (e.g. "Step 1: The Rapport Starter")
- "subject": The email subject line (no placeholders, under 9 words)
- "content": The full email body — greeting included, NO sign-off, NO signature`;

    const userPrompt = `Generate a 5-step cold outreach sequence for the "${niche}" niche. The outreach must specifically address the business objectives and pain points relevant to ${niche} prospects, matching the specific service offerings and vertical targets described in the business overview. Return the output strictly as a json object.`;
    const contextPrompt = `
Our company is "${company}". Use [MY COMPANY] to represent our company name in the templates.${pitch ? `
We are specifically pitching: "${pitch}". Every email angle, hook, and value proposition must be grounded in THIS specific offering — not a generic version of it.` : ''}
The campaign target niche is: "${niche}". Read the Business Overview to locate the specific vertical, target audience, and business objectives corresponding to this niche, and write emails tailored exactly to those target objectives.
The tone should feel like a genuinely helpful person reaching out — curious, concise, and human.
Use [PERSONALISED DETAIL] as the anchor for personalisation. Do NOT invent specific facts.
Do NOT mention the lead's role or job title anywhere in the emails.
Each email MUST be completely different in topic and approach — no repetition across steps.

SUBJECT LINE REQUIREMENT: Each subject line must be sharply niche-specific to "${niche}".`;

    try {
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
      
      // 6. Save templates
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
      
      // 7. Generate schedules
      const startDate = new Date();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
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
          .insert(
            emailAccountIds.map(accId => ({
              schedule_id: scheduleData.id,
              email_account_id: accId,
              emails_sent: 0,
              emails_remaining: 500
            }))
          );
      }
      
      // 8. Update campaign status based on lead count
      const { count: leadCount } = await supabase
        .from('campaign_leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);
        
      const targetStatus = (leadCount && leadCount > 1000) ? 'review' : 'paused';
      await supabase
        .from('campaigns')
        .update({ status: targetStatus })
        .eq('id', campaign.id);
        
      console.log(`✅ Campaign "${campaign.name}" successfully regenerated (status: ${targetStatus}).`);
    } catch (err) {
      console.error(`❌ Failed to regenerate campaign "${campaign.name}":`, err.message);
    }
  }
  
  console.log(`\nAll campaigns successfully regenerated using DeepSeek!`);
}

run().catch(console.error);
