import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const groqKey = process.env.GROQ_API_KEY;
const defaultEmailAccountId = 'd87152f1-6c2a-4362-be9d-539050fd07e7'; // relaysolutionsltd@gmail.com

async function generateTemplatesAI(campaign) {
  console.log(`Generating 5 sequence templates via Groq for campaign: "${campaign.name}"...`);
  
  const systemPrompt = `You are an expert campaign copywriter. Generate a 5-step cold email sequence targeting "${campaign.niche || 'businesses'}".
The objective is: "${campaign.objective || campaign.pitch || 'Outreach'}".
Each email must be extremely brief, witty, active voice, conversational, under 50 words.
Do not include subject line placeholders, nor email body sign-offs or signatures.

Return a JSON object with a "templates" array containing exactly 5 items:
{
  "templates": [
    { "name": "Step 1: The Pattern Interrupt", "subject": "string", "content": "string" },
    { "name": "Step 2: The Value Add", "subject": "string", "content": "string" },
    { "name": "Step 3: The Social Proof Nudge", "subject": "string", "content": "string" },
    { "name": "Step 4: The Soft Touch", "subject": "string", "content": "string" },
    { "name": "Step 5: The Breakup", "subject": "string", "content": "string" }
  ]
}`;

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Niche: ${campaign.niche}\nObjective: ${campaign.pitch || campaign.objective}` }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} - ${await response.text()}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  return result.templates;
}

async function run() {
  const { data: campaigns, error: campError } = await supabase
    .from('campaigns')
    .select('*, businesses(*)');
    
  if (campError) {
    console.error('Error fetching campaigns:', campError);
    return;
  }
  
  console.log(`Analyzing ${campaigns.length} campaigns...`);
  
  for (const campaign of campaigns) {
    const { count: leadCount } = await supabase
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    if (leadCount <= 1) {
      console.log(`Campaign "${campaign.name}" has ${leadCount} leads (<= 1). Skipping sequence/schedule generation.`);
      continue;
    }
    
    const { count: scheduleCount } = await supabase
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
      
    if (scheduleCount > 0) {
      console.log(`Campaign "${campaign.name}" already has ${scheduleCount} schedules. Skipping generation.`);
      continue;
    }
    
    console.log(`\nGenerating sequences and schedules for campaign: "${campaign.name}" (${leadCount} leads)...`);
    
    // 1. Ensure linked email account
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
    
    // 2. Ensure templates exist
    let { data: templates } = await supabase
      .from('templates')
      .select('*')
      .eq('campaign_id', campaign.id);
      
    if (!templates || templates.length === 0) {
      try {
        const generated = await generateTemplatesAI(campaign);
        console.log(`-> Generated ${generated.length} templates via Groq AI.`);
        
        for (const t of generated) {
          await supabase
            .from('templates')
            .insert({
              campaign_id: campaign.id,
              name: t.name,
              subject: t.subject,
              content: t.content
            });
        }
        
        // Re-fetch templates
        const { data: refetched } = await supabase
          .from('templates')
          .select('*')
          .eq('campaign_id', campaign.id);
        templates = refetched;
      } catch (err) {
        console.error('Failed to generate templates via Groq AI:', err.message);
        continue;
      }
    }
    
    console.log(`-> Using ${templates.length} templates.`);
    
    // 3. Generate schedules in scheduled_emails
    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days later
    
    for (const tpl of templates) {
      console.log(`-> Scheduling template "${tpl.name}"...`);
      const { data: scheduleData, error: schedError } = await supabase
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
        
      if (schedError) {
        console.error(`Failed to insert schedule:`, schedError);
        continue;
      }
      
      // 4. Link schedules to email accounts in schedule_email_accounts
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
    
    // 5. Update campaign status to 'review' since leadCount > 1000 and schedules now exist
    console.log(`-> Setting campaign status to "review"...`);
    await supabase
      .from('campaigns')
      .update({ status: 'review' })
      .eq('id', campaign.id);
      
    console.log(`✅ Campaign "${campaign.name}" sequences generated and schedules created successfully!`);
  }
  
  console.log('\nAll campaigns processed.');
}

run().catch(console.error);
