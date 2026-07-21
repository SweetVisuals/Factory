import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const groqKey = process.env.GROQ_API_KEY;
const userId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643'; // ptnmgmt@gmail.com
const emailAccountId = 'd87152f1-6c2a-4362-be9d-539050fd07e7'; // relaysolutionsltd@gmail.com
const businessId = '8a181939-1e1d-45f1-a6f9-38cd09927802'; // Relay ColdEmail AI Brief

async function generateCampaignsAI(briefText) {
  console.log('Generating 3 campaigns with Llama 3...');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert campaign strategist. Analyze the provided trade-focused business overview brief.
Generate 3 distinct cold email outreach campaigns for Relay Solutions targeting:
1. Construction & Building Firms
2. Landscaping & Groundworks Services
3. Roofing Contractors

For EACH of the 3 campaigns, return a JSON object with:
- name: The campaign name (e.g. "UK Builders & Contractors Outreach")
- niche: The keyword search term (e.g. "building contractors")
- objective: The core pitch/objective describing the pain point (e.g., automated estimating and quotes)
- templates: An array of 3 email templates representing the 3-step sequence defined in the brief:
  - name: "Step 1: Hook", "Step 2: Nudge", "Step 3: Close"
  - subject: The subject line of the email (must use placeholders like {{first_name}} and {{company}} where appropriate)
  - content: The email body content (must be extremely brief, witty, active voice, under 45 words for step 1, under 90 words for step 2, under 30 words for step 3)

Respond ONLY with a valid JSON object matching this schema:
{
  "campaigns": [
    {
      "name": "string",
      "niche": "string",
      "objective": "string",
      "templates": [
        { "name": "string", "subject": "string", "content": "string" }
      ]
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Here is the Business Brief:\n\n${briefText}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} - ${await response.text()}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  return result.campaigns;
}

async function run() {
  try {
    // 1. Fetch current brief
    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .select('overview_md')
      .eq('id', businessId)
      .single();

    if (bizErr) throw bizErr;

    // 2. Generate via AI
    const campaigns = await generateCampaignsAI(biz.overview_md);
    console.log(`Generated ${campaigns.length} campaigns from AI successfully.`);

    // 3. Insert each campaign
    for (const c of campaigns) {
      console.log(`Inserting campaign: "${c.name}"...`);
      
      const { data: newCampaign, error: insertErr } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          business_id: businessId,
          name: c.name,
          niche: c.niche,
          pitch: c.objective,
          objective: c.objective,
          status: 'active',
          schedule: {
            frequency: 'daily',
            maxEmailsPerDay: 100
          }
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`Failed to insert campaign "${c.name}":`, insertErr.message);
        continue;
      }

      console.log(`✅ Campaign "${c.name}" created (ID: ${newCampaign.id})`);

      // Link email account
      const { error: linkErr } = await supabase
        .from('campaign_email_accounts')
        .insert({
          campaign_id: newCampaign.id,
          email_account_id: emailAccountId
        });

      if (linkErr) {
        console.error(`Failed to link email account to campaign:`, linkErr.message);
      } else {
        console.log(`🔗 Linked email account: ${emailAccountId}`);
      }

      // Insert templates
      for (const t of c.templates) {
        const { error: tempErr } = await supabase
          .from('templates')
          .insert({
            campaign_id: newCampaign.id,
            name: t.name,
            subject: t.subject,
            content: t.content
          });

        if (tempErr) {
          console.error(`Failed to insert template "${t.name}":`, tempErr.message);
        } else {
          console.log(`📝 Created template "${t.name}"`);
        }
      }
    }

    console.log('🚀 All 3 campaigns successfully created, linked, and set to ACTIVE!');
  } catch (error) {
    console.error('Fatal error during campaign creation:', error.message);
  }
}

run();
