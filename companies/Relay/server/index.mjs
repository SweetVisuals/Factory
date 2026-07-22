import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server's parent directory (companies/Relay)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { validateEmail } from './email-validation.mjs';
import { fetchAIChatCompletion } from './ai-client.mjs';
import { executionQueue } from './execution_queue.mjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

import { Country, City } from 'country-state-city';
import { scrapeLeadsNoPuppeteer } from './scraper_http.mjs';
import { startCompaniesHouseCron } from './companies_house_cron.mjs';
import { startAutoAssignCron } from './auto_assign_cron.mjs';
import { startScraperSchedulerCron } from './scraper_scheduler_cron.mjs';
import { startResearchCron } from './research_cron.mjs';
import { initOldLeadsMigrator } from './old_leads_migrator.mjs';
import { generateEmail } from './email_engine.mjs';
import { researchAndSummarizeLead, AIRateLimitError } from './research_helper.mjs';
import { startEmailerCron } from './emailer_cron.mjs';
import { startBounceProcessorCron } from './bounce_processor_cron.mjs';
import { startSyncEmailsCron } from './sync_emails_cron.mjs';

// Prevent Puppeteer temp profile deletion errors (EBUSY unlink) from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.code === 'EBUSY' && reason.syscall === 'unlink') {
    return; // Silently ignore Puppeteer temp file issues
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  if (err && err.code === 'EBUSY' && err.syscall === 'unlink') {
    console.error(`[Ignored] Puppeteer temp profile unlink error (uncaughtException): ${err.path || 'unknown path'}`);
    return;
  }
  console.error('Uncaught Exception:', err);
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL ERROR: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.');
}

// Create client only if vars exist to prevent crash, otherwise null
export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const client = supabase;

const originalLog = console.log;
const originalError = console.error;

if (supabase) {
  console.log = function (...args) {
    originalLog.apply(console, args);
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    
    // Auto-stream cron scheduler, email flow, and scrape events to db
    if (
      msg.startsWith('[') || 
      msg.toLowerCase().includes('cron') || 
      msg.toLowerCase().includes('scheduler') ||
      msg.toLowerCase().includes('emailer') ||
      msg.toLowerCase().includes('bounce') ||
      msg.toLowerCase().includes('sync') ||
      msg.toLowerCase().includes('research') ||
      msg.toLowerCase().includes('processing')
    ) {
      supabase.from('debug_logs').insert({
        level: 'info',
        message: msg,
        context: {}
      }).then(({ error }) => {
        if (error) originalError('[Logger error] Failed to insert log to DB:', error.message);
      });
    }
  };

  console.error = function (...args) {
    originalError.apply(console, args);
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    
    supabase.from('debug_logs').insert({
      level: 'error',
      message: msg,
      context: {}
    }).then(({ error }) => {
      if (error) originalLog('[Logger error] Failed to insert error log to DB:', error.message);
    });
  };
}

const app = express();
app.use(express.json());

// Add a root route for health check
app.get('/', (req, res) => {
  res.send('ColdSpark Backend API is running. Time: ' + new Date().toISOString());
});
app.get('/api', (req, res) => {
  res.send('API Root Accessible');
});

// Unsubscribe Endpoint
app.get('/api/unsubscribe', async (req, res) => {
  const { leadId, campaignId } = req.query;
  if (!leadId) {
    return res.status(400).send('Invalid unsubscribe link.');
  }
  try {
    // Mark lead as unsubscribed
    await supabaseAdmin.from('leads').update({ status: 'unsubscribed' }).eq('id', leadId);
    
    // Optionally update campaign progress
    if (campaignId) {
      await supabaseAdmin.from('campaign_progress').upsert({
        campaign_id: campaignId,
        lead_id: leadId,
        status: 'unsubscribed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: false });
    }
    
    res.send(`
      <html>
        <head><title>Unsubscribed</title><style>body{font-family:sans-serif;text-align:center;padding:50px;color:#333;} h1{color:#ef4444;}</style></head>
        <body>
          <h1>Unsubscribed Successfully</h1>
          <p>You have been successfully removed from our mailing list and will no longer receive communications from us.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send('An error occurred processing your request.');
  }
});
app.use(cors({
  origin: true, // Reflect request origin to allow all
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-campaign-id']
}));

// Handle preflight requests explicitly
app.options('*', cors());

// --- HERMES AGENT ENDPOINTS ---

app.post('/api/hermes/chat', async (req, res) => {
  const pythonPath = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe";
  const hermesBase = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent";
  const hermesPath = path.join(hermesBase, "hermes");

  try {
    const { message, yolo = true, sessionName } = req.body;
    if (!message) throw new Error('Message is required');
    if (!fs.existsSync(pythonPath)) throw new Error('Hermes agent is not installed on this server environment.');

    const args = [hermesPath, 'chat', '-q', message, '-Q'];
    if (yolo) args.push('--yolo');
    if (sessionName) {
      args.push('-c', sessionName);
    }

    console.log(`[Hermes] Executing chat: ${message}`);
    
    const { stdout, stderr } = await execFilePromise(pythonPath, args, {
      cwd: hermesBase,
      env: { 
        ...process.env, 
        PYTHONPATH: hermesBase,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'sk-d703ac9c0fe74d05b1693c50a81ea9bc',
        OPENAI_API_KEY: process.env.DEEPSEEK_API_KEY || 'sk-d703ac9c0fe74d05b1693c50a81ea9bc'
      }
    });

    res.json({ success: true, response: stdout, logs: stderr });
  } catch (err) {
    console.error(`[Hermes Error] ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: err.message, 
      stderr: err.stderr,
      stdout: err.stdout 
    });
  }
});

app.get('/api/hermes/skills', async (req, res) => {
  const pythonPath = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe";
  const hermesBase = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent";
  const hermesPath = path.join(hermesBase, "hermes");

  try {
    if (!fs.existsSync(pythonPath)) throw new Error('Hermes agent is not installed on this server environment.');
    const { stdout } = await execFilePromise(pythonPath, [hermesPath, 'skills', 'list'], {
      cwd: hermesBase,
      env: { 
        ...process.env, 
        PYTHONPATH: hermesBase,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        OPENAI_API_KEY: process.env.DEEPSEEK_API_KEY
      }
    });
    res.json({ success: true, skills: stdout });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/hermes/status', async (req, res) => {
  const pythonPath = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe";
  const hermesBase = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent";
  const hermesPath = path.join(hermesBase, "hermes");

  try {
    if (!fs.existsSync(pythonPath)) throw new Error('Hermes agent is not installed on this server environment.');
    const { stdout } = await execFilePromise(pythonPath, [hermesPath, '--version'], {
      cwd: hermesBase,
      env: { ...process.env, PYTHONPATH: hermesBase }
    });
    res.json({ success: true, version: stdout.trim(), status: 'online' });
  } catch (err) {
    res.json({ success: true, status: 'offline', error: err.message });
  }
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-d703ac9c0fe74d05b1693c50a81ea9bc';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

app.post('/api/edit-brief-ai', async (req, res) => {
  try {
    const { prompt, markdown, userId } = req.body;
    if (!prompt || !markdown || !userId) {
      return res.status(400).json({ error: 'Missing required parameters: prompt, markdown, userId' });
    }

    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const limitKey = `groq_brief_usage_${userId}_${dateStr}`;

    // Get current usage count
    let currentCount = 0;
    const { data: memoryRecord } = await supabase
      .from('agent_memory')
      .select('value')
      .eq('key_name', limitKey)
      .maybeSingle();

    if (memoryRecord && memoryRecord.value) {
      currentCount = memoryRecord.value.count || 0;
    }

    if (currentCount >= 5) {
      return res.status(429).json({ error: 'Daily limit reached. You can only use the Groq AI editor 5 times per day.' });
    }

    // Increment count
    await supabase.from('agent_memory').upsert({
      key_name: limitKey,
      value: { count: currentCount + 1 }
    }, { onConflict: 'key_name' });

    // Call Groq
    const result = await fetchAIChatCompletion({
      model: 'meta-llama/llama-3-8b-instruct:free',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are an expert copywriter. Your task is to edit and refine the provided markdown business overview brief according to the user's instructions.
CRITICAL RULES:
1. Return ONLY the edited markdown text.
2. DO NOT wrap the output in markdown code blocks (\`\`\`markdown or \`\`\`). Just return the raw text.
3. DO NOT include any chat, introductions, explanations, or greeting.
4. Keep the general structure, segments, and formatting of the brief intact, only modifying the sections as instructed.`
        },
        {
          role: 'user',
          content: `Original Brief:\n${markdown}\n\nInstructions from user: "${prompt}"`
        }
      ]
    });

    const editedMarkdown = result?.choices?.[0]?.message?.content?.trim();
    if (!editedMarkdown) {
      throw new Error('AI returned an empty response.');
    }

    res.json({ success: true, markdown: editedMarkdown, usageCount: currentCount + 1 });
  } catch (err) {
    console.error('Groq brief edit failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});
const TEMPLATE_PLACEHOLDERS = [
  { placeholder: '[LEAD COMPANY]', description: 'The exact name of the prospect company' },
  { placeholder: '[LEAD FIRST NAME]', description: 'The first name of the prospect' },
  { placeholder: '[MY COMPANY]', description: 'The name of our sending company' },
  { placeholder: '[PERSONALISED DETAIL]', description: 'A short fact or detail about their specific business extracted from research' },
  { placeholder: '[INDUSTRY]', description: 'The specific niche or industry of the prospect' }
];

async function generateAndSaveSequencesForCampaign(campaignId, autoPause = true) {
  try {
    const { data: campaign } = await client.from('campaigns').select('*, businesses(*)').eq('id', campaignId).single();
    if (!campaign) return false;

    const niche = campaign.niche || 'General Business';
    const company = campaign.company_name || 'Our Company';
    const pitch = campaign.pitch || campaign.objective || '';

    let businessOverview = campaign.businesses?.overview_md || '';
    let emailToneContent = '';
    
    if (campaign.email_tone_id) {
      const { data: tone } = await client.from('email_tones').select('content_md').eq('id', campaign.email_tone_id).single();
      if (tone) {
        emailToneContent = tone.content_md || '';
      }
    }

    const pitchContext = pitch ? `
Your Pitch / Service Offering: "${pitch}"
This is the specific product or service being offered. Every email must feel like it was written specifically around this offering — the value, the angle, the curiosity — all tied to what you do. Do NOT be generic.` : '';

    const businessPrompt = businessOverview ? `\n\nOUR BUSINESS OVERVIEW:\n${businessOverview}\n` : '';
    const tonePrompt = emailToneContent ? `\n\nWRITING TONE AND STYLE RULES:\n${emailToneContent}\n` : '';

    const placeholderListStr = TEMPLATE_PLACEHOLDERS.map(p => `- ${p.placeholder}: ${p.description}`).join('\n');

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
You MUST use these exact placeholders whenever referring to dynamic data. DO NOT invent your own placeholders (like {{industry}} or [Your Service]). ONLY use the ones from this list:
${placeholderListStr}

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

Step 1 — "The Intro":
This is the first touch. Focus entirely on building rapport and starting a conversation.
- Sound like a real, helpful human. Start with a light, slightly playful or humorous connection point relevant to [INDUSTRY] or their world.
- Do NOT pitch anything here. The ONLY goal is connection and starting a conversation.
- Use [PERSONALISED DETAIL] naturally if it anchors the opener.
- Keep it under 50 words total.

Step 2 — "The Follow Up":
They've seen you once — now pick up the pace and follow up more directly.
- Pivot to showing value and introducing your offering/solution in a playful, results-driven way.
- Frame your custom solution to their industry pain points.
- Keep it short, direct, and under 55 words.

Step 3 — "The Close":
Polite, direct exit. Leave the door open warmly.
- Frame the exit with a closing phrase like: "no worries, or is it okay if we contact you again in a few months if anything changed?"
- Keep it under 40 words.

Output Format: JSON object with a "sequences" array of EXACTLY 3 objects.
Each object MUST have EXACTLY these 3 keys:
- "name": Step title (e.g. "Step 1: The Intro")
- "subject": The email subject line (no placeholders, under 9 words)
- "content": The full email body — greeting included, NO sign-off, NO signature
`;

    const userPrompt = `Generate a 3-step cold outreach sequence (Intro, Follow Up, and Close) for the "${niche}" niche. The outreach must specifically address the business objectives and pain points relevant to ${niche} prospects, matching the specific service offerings and vertical targets described in the business overview.`;
    const contextPrompt = `
Our company is "${company}". Use [MY COMPANY] to represent our company name in the templates.${pitch ? `
We are specifically pitching: "${pitch}". Every email angle, hook, and value proposition must be grounded in THIS specific offering — not a generic version of it.` : ''}
The campaign target niche is: "${niche}". Read the Business Overview to locate the specific vertical, target audience, and business objectives corresponding to this niche, and write emails tailored exactly to those target objectives.
The tone should feel like a genuinely helpful person reaching out — curious, concise, and human.
Use [PERSONALISED DETAIL] as the anchor for personalisation. Do NOT invent specific facts.
Do NOT mention the lead's role or job title anywhere in the emails.
Each email MUST be completely different in topic and approach — no repetition across steps.

SUBJECT LINE REQUIREMENT: Each subject line must be sharply niche-specific to "${niche}" and genuinely intriguing to a decision-maker in that space. Think carefully about the real daily challenges, ambitions, and pressures of someone running a business in the "${niche}" industry, and write subjects that speak directly to those. Be bold, be specific, be original. Do NOT use generic phrases.`;

    const data = await fetchAIChatCompletion({
      model: 'deepseek-chat',
      temperature: 1.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt + contextPrompt }
      ],
      response_format: { type: 'json_object' }
    }, console.log);

    const contentString = data.choices[0].message.content;
    const content = JSON.parse(contentString);
    let sequences = Array.isArray(content) ? content : (content.sequences || content.emails);
    if (!sequences && typeof content === 'object') {
      const firstArrayKey = Object.keys(content).find(key => Array.isArray(content[key]));
      if (firstArrayKey) sequences = content[firstArrayKey];
    }
    sequences = sequences || [];

    // Save sequences to templates
    for (let i = 0; i < sequences.length; i++) {
      const step = sequences[i];
      await client.from('templates').insert({
        campaign_id: campaignId,
        name: step.name || `Step ${i + 1}`,
        subject: step.subject || '',
        content: step.content || ''
      });
    }

    // Set campaign status to paused to trigger review workflow, if requested
    if (autoPause) {
      await client.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
      console.log(`[Automated Sequences] Successfully generated 3 sequence templates for campaign ${campaignId} and set to paused.`);
    } else {
      console.log(`[Automated Sequences] Successfully generated 3 sequence templates for campaign ${campaignId} (status unchanged).`);
    }
    return true;

  } catch (error) {
    console.error('[Automated Sequences] Generation Error:', error);
    return false;
  }
}

// Endpoint to trigger instant sequence generation on campaign creation
app.post('/api/campaigns/:id/generate-sequences', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Instant Sequences] Starting generation for campaign: ${id}`);
    const success = await generateAndSaveSequencesForCampaign(id, false);
    if (success) {
      res.json({ success: true, message: 'Sequences generated successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Sequence generation failed' });
    }
  } catch (err) {
    console.error('[Instant Sequences] API Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function ensureCampaignSchedules(campaignId) {
  try {
    // 1. Check if campaign has > 1 lead
    const { count: leadCount } = await client
      .from('campaign_leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);
      
    if (!leadCount || leadCount <= 1) return;

    // Check if campaign has a business assigned to it
    const { data: campaign } = await client
      .from('campaigns')
      .select('business_id')
      .eq('id', campaignId)
      .single();
      
    if (!campaign || !campaign.business_id) {
      console.log(`[Auto Schedule] Campaign ${campaignId} has no business profile assigned. Skipping sequence/schedule generation.`);
      return;
    }
    
    // 2. Check if schedules already exist
    const { count: scheduleCount } = await client
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);
      
    if (scheduleCount > 0) return; // Already generated
    
    console.log(`[Auto Schedule] Triggering schedule generation for campaign ${campaignId} with ${leadCount} leads...`);
    
    // 3. Ensure templates exist (if not, call generateAndSaveSequencesForCampaign)
    let { data: templates } = await client
      .from('templates')
      .select('*')
      .eq('campaign_id', campaignId);
      
    if (!templates || templates.length === 0) {
      console.log(`[Auto Schedule] No templates found. Generating templates first...`);
      const success = await generateAndSaveSequencesForCampaign(campaignId, false);
      if (!success) {
        console.error(`[Auto Schedule] Failed to generate templates for campaign ${campaignId}`);
        return;
      }
      
      // Re-fetch templates
      const { data: refetched } = await client
        .from('templates')
        .select('*')
        .eq('campaign_id', campaignId);
      templates = refetched;
    }
    
    if (!templates || templates.length === 0) return;
    
    // 4. Ensure linked email account
    const { data: linkedAccounts } = await client
      .from('campaign_email_accounts')
      .select('email_account_id')
      .eq('campaign_id', campaignId);
      
    let emailAccountIds = (linkedAccounts || []).map(a => a.email_account_id);
    if (emailAccountIds.length === 0) {
      const defaultEmailAccountId = 'd87152f1-6c2a-4362-be9d-539050fd07e7';
      await client
        .from('campaign_email_accounts')
        .insert({
          campaign_id: campaignId,
          email_account_id: defaultEmailAccountId
        });
      emailAccountIds = [defaultEmailAccountId];
    }
    
    // 5. Generate schedules in scheduled_emails
    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    for (const tpl of templates) {
      const { data: scheduleData, error: schedError } = await client
        .from('scheduled_emails')
        .insert({
          campaign_id: campaignId,
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
        console.error(`[Auto Schedule] Failed to insert schedule:`, schedError);
        continue;
      }
      
      // 6. Link schedules to email accounts in schedule_email_accounts
      await client
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
    
    // 7. Update campaign status. If > 1000 leads, 'review'. Else 'paused'.
    const targetStatus = leadCount > 1000 ? 'review' : 'paused';
    await client
      .from('campaigns')
      .update({ status: targetStatus })
      .eq('id', campaignId);
      
    console.log(`[Auto Schedule] Successfully generated schedules for campaign ${campaignId} (status: ${targetStatus}).`);
    
  } catch (error) {
    console.error('[Auto Schedule] Error generating schedules:', error);
  }
}

app.post('/api/generate-sequences', async (req, res) => {
  try {
    const { campaignName, niche, company, pitch, contactNumber, primaryEmail, count = 5, isSingle = false, targetStep = 1 } = req.body;

    const pitchContext = pitch ? `
Your Pitch / Service Offering: "${pitch}"
This is the specific product or service being offered. Every email must feel like it was written specifically around this offering — the value, the angle, the curiosity — all tied to what you do. Do NOT be generic.` : '';

    const systemPrompt = `You are an elite B2B cold email copywriter. You write like a real human, not a marketing department.
Every email must feel like it came from someone who genuinely understands the recipient's industry — not someone blasting a mass list.${pitchContext}

ABSOLUTE RULES (violation = failure):
1. GREETING: Always "Hi {{first_name}}," — NEVER full name, NEVER last name.
2. NEVER mention the lead's job title, role, or position anywhere.
3. BANNED PHRASES — never use any of these under any circumstances:
   "sounds interesting", "I thought it was interesting", "I found it interesting",
   "I hope this finds you well", "I wanted to reach out", "touch base", "I came across your website",
   "I noticed you", "just checking in", "circling back", "synergy", "leverage", "unlock potential", "game-changer".
4. SUBJECT LINES — critically important:
   a. NEVER use placeholders ({{first_name}}, {{company}}) in the subject.
   b. Each subject must feel completely different in format and approach.
   c. Niche-specific and intriguing — a busy decision-maker must WANT to open it.
   d. Under 9 words. Sentence-case only.
   e. BANNED subject styles: "Quick question", "Following up", "Checking in", "Touching base", "Partnership opportunity".
   f. Mix formats across the 5 steps: bold statement, provocative question, insight teaser, personal check-in, graceful exit.
5. DO NOT INCLUDE ANY SIGN-OFF, "Best,", "Regards,", or any closing in the body. The system auto-appends the signature.
6. Plain text only. No HTML. Normal line breaks between paragraphs.
7. Each step MUST cover a completely unique angle — no repeated topics, features, or ideas across steps.
8. SPECIFIC USE CASES & SOLUTIONS: Instead of talking about generic benefits (like "streamlining operations" or "increasing efficiency"), describe a highly concrete, realistic custom solution tailored specifically to the targeted niche. Show them EXACTLY what we can do for them, BUT this must be derived entirely from the provided Pitch / Service Offering. Do NOT invent random services or pain points that do not align with the pitch.
9. NEVER SELL OR PITCH DIRECTLY. Your ONLY goal is to book a calendar slot or phone call by enquiring about their current struggles and hurdles. DO NOT offer a solution immediately. Be genuinely curious about their pain points.

STEP ARCHETYPES — follow each one precisely:

Step 1 — "The Pattern Interrupt":
This is the very first cold email. Its ONLY job is to NOT sound like every other cold email they receive.
- The opening sentence must immediately signal that you understand their world — reference something specific to the {{industry}} space or {{company}}.
- Do NOT open with a generic observation or compliment. Go straight to something that makes them think "how did they know that?"
- Ask ONE sharp, unexpected question OR make ONE bold statement that makes them genuinely curious about what you do.
- The email should feel like a quick DM from someone in their network — not a pitch.
- Keep it under 60 words total.
- Use [[notes]] naturally if it helps anchor the opener to their specific business.

Step 2 — "The Value Add":
They've seen you once — now prove you're worth their time.
- Lead with a useful industry insight, stat, or observation relevant to the ${niche} niche that they might not know.
- Frame your offer as a natural extension of that insight — never a pitch.
- ONE clear CTA: a direct question or "worth a quick 10 minutes?"
- Tone: confident but not pushy. Like sharing something useful with a peer.

Step 3 — "The Social Proof Nudge":
They've seen you twice — now build quiet credibility without bragging.
- Reference a concrete result, outcome, or scenario relevant to someone in the ${niche} space.
- Tell it like a quick story, not a case study.
- End with a low-friction CTA: "Curious if this rings a bell for you?" or similar.

Step 4 — "The Soft Touch":
Super short and human. Like bumping into someone in a hallway.
- Acknowledge time has passed without being needy or apologetic.
- One sentence framing. One question. That's it.
- Under 40 words (excluding greeting and the signature placeholder block).

Step 5 — "The Breakup":
Polite, confident closure — the "breakup" framework that often drives last-second replies.
- Tell them this is your last email. No hard feelings at all.
- Leave the door open warmly: "If timing changes, I'm easy to find."
- Do NOT sound desperate, passive-aggressive, or guilt-trippy.
- Project abundance: you don't need them. You're just genuinely offering.
- Under 45 words (excluding greeting and signature placeholder block).

Output Format: JSON object with a "sequences" array of EXACTLY ${isSingle ? 1 : count} objects.
Each object MUST have EXACTLY these 3 keys:
- "name": Step title (e.g. "Step ${isSingle ? targetStep : '1'}: ${isSingle ? 'Regenerated' : 'The Pattern Interrupt'}")
- "subject": The email subject line (no placeholders, under 9 words)
- "content": The full email body — greeting included, NO sign-off, NO signature
`;


    const userPrompt = isSingle
      ? `Regenerate Step ${targetStep} of a cold outreach sequence for the "${niche}" niche.
Follow the archetype for Step ${targetStep} strictly.`
      : `Generate a 5-step cold outreach sequence for the "${niche}" niche.`;

    const contextPrompt = `
Our company is "${company}". Use <company> to represent our company name in the templates.${pitch ? `
We are specifically pitching: "${pitch}". Every email angle, hook, and value proposition must be grounded in THIS specific offering — not a generic version of it.` : ''}
The tone should feel like a genuinely helpful person reaching out — curious, concise, and human.
Use [[notes]] as the anchor for personalisation. Do NOT invent specific facts.
Do NOT mention the lead's role or job title anywhere in the emails.
${isSingle ? '' : 'Each email MUST be completely different in topic and approach — no repetition across steps.'}

SUBJECT LINE REQUIREMENT: Each subject line must be sharply niche-specific to "${niche}" and genuinely intriguing to a decision-maker in that space. Think carefully about the real daily challenges, ambitions, and pressures of someone running a business in the "${niche}" industry, and write subjects that speak directly to those. Be bold, be specific, be original. Do NOT use generic phrases.`;

    const data = await fetchAIChatCompletion({
      model: 'deepseek-chat',
      temperature: 1.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt + contextPrompt }
      ],
      response_format: { type: 'json_object' }
    }, console.log);

    const contentString = data.choices[0].message.content;
    console.log('AI Content:', contentString);

    const content = JSON.parse(contentString);

    // Improved normalization: Look for any array in the object if sequences/emails not found
    let sequences = Array.isArray(content) ? content : (content.sequences || content.emails);

    if (!sequences && typeof content === 'object') {
      // Fallback: search for the first property that is an array
      const firstArrayKey = Object.keys(content).find(key => Array.isArray(content[key]));
      if (firstArrayKey) {
        sequences = content[firstArrayKey];
      }
    }

    sequences = sequences || [];

    res.json({ success: true, data: sequences });
  } catch (error) {
    console.error('Sequence Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate sequences'
    });
  }
});

app.get('/api/campaigns/:id/preview-email', async (req, res) => {
  try {
    const { id } = req.params;
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Fetch Campaign
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('campaigns')
      .select('*, businesses(*)')
      .eq('id', id)
      .single();
      
    if (campErr || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // 2. Fetch One Lead with a valid email address
    const { data: campLeads, error: leadErr } = await supabaseAdmin
      .from('campaign_leads')
      .select('leads!inner(*)')
      .eq('campaign_id', id)
      .not('leads.email', 'eq', '')
      .not('leads.email', 'is', null)
      .limit(1);
      
    if (leadErr || !campLeads || campLeads.length === 0 || !campLeads[0].leads) {
      return res.status(404).json({ success: false, error: 'No leads found with a valid email address in this campaign to preview.' });
    }
    
    const lead = campLeads[0].leads;

    // 3. Fetch Tone (if any)
    let emailToneData = null;
    if (campaign.email_tone_id) {
      const { data: tone } = await supabaseAdmin
        .from('email_tones')
        .select('*')
        .eq('id', campaign.email_tone_id)
        .single();
      emailToneData = tone;
    }

    // 4. Generate Preview
    const engineResult = generateEmail({
      lead: lead,
      campaign: campaign,
      business: campaign.businesses,
      emailTone: emailToneData,
      stepIndex: 0,
      totalSteps: 5,
      senderAccount: { name: 'Preview Sender', email: 'preview@example.com' }
    });

    res.json({ success: true, data: { lead, email: engineResult } });
  } catch (error) {
    console.error('Preview Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview'
    });
  }
});

app.post('/api/generate-lead-emails', async (req, res) => {
  try {
    const { campaignId, leads, templateContent, templateSubject, company, contactNumber, primaryEmail } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      throw new Error('No leads provided');
    }

    const results = [];

    // Process leads in parallel but with a small concurrency limit to avoid hitting DeepSeek rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (lead) => {
        const leadFirstName = lead.name ? lead.name.split(' ')[0] : '';
        const systemPrompt = `You are a professional B2B Cold Outreach Marketer.
REWRITE this email template for a specific lead. 

Instructions for tone & length:
- Keep it SHORT, punchy, and highly conversational. Do NOT be wordy or overly formal.
- DO NOT use complex, technical sales jargon. Speak like a normal human peer.
- If the original template is long, aggressively shorten it while keeping the core message.
- TONE CORRECTION: If the template sounds pestery, desperate, or needy, REWRITE it to be confident and understanding. For breakup/final emails:
  * NEVER say "I'll stop filling up your inbox" or "This is my last attempt" — that sounds desperate.
  * Instead use confident, understanding phrasing like "No worries if this isn't the right time" or "Totally understand if this isn't a priority right now."
  * Project abundance: you don't NEED them. You're genuinely offering value and are happy to leave them to it.

Instructions for personalization:
1. Replace [[notes]] with a specific, brief observation from the Research Notes. 
2. CRITICAL ANTI-HALLUCINATION RULE: NEVER invent or assume facts, industries, or concepts (e.g., "trucks", "real estate", "e-commerce") that are NOT explicitly mentioned in the Research Notes. Completely rewrite examples that do not fit the notes.
3. GREETING: Start with "Hi ${leadFirstName}," — NEVER use full names or last names.
4. Replace {{first_name}} with "${leadFirstName}" and {{company}} with "${lead.company || ''}".
5. CRITICAL: Replace <company> with our company name: "${company}". Do NOT confuse our company with the lead's company.
6. CRITICAL: NEVER mention the lead's job title, role, or position. Remove any such references.
7. DO NOT touch the signature block at the end (starting from {ender}).
8. DO NOT include any additional sign-offs (e.g., "Best").
9. Output: JSON ("subject", "content").
10. CUSTOM SOLUTION RULE: Tailor the product/service offer to the lead's specific industry and deduced pain points using concrete, practical examples (e.g., for a restaurant, suggest building a custom system that automatically syncs and reduces stock count when orders are placed and automatically reverts it if an order is cancelled; for an agency, suggest a secure client portal to avoid emailing files; for a contractor, suggest real-time sync between field techs and office dispatch). Show the recipient EXACTLY how our custom automation solves their manual headache in a clear, practical way.

Context:
Our Company (Sender): ${company}
Lead's Company (Recipient): ${lead.company}
First Name: ${leadFirstName}
Research Notes: "${lead.summary || 'General interest'}"

Template Subject: ${templateSubject}
Template Body: ${templateContent}`;

        const userPrompt = `Personalise the email for ${leadFirstName} at ${lead.company || 'their company'}. You are sending this from our company, ${company}.
Ensure NO full names, NO job titles, NO added sign-offs. 
Make the email strictly SHORT, natural, non-technical, and conversational. NEVER sell or pitch directly. Your goal is to enquire about their struggles/hurdles and secure a calendar booking.
The subject line MUST be hyper-personalized using the Research Notes about their website or goals.
Return ONLY JSON with 'subject' and 'content'.`;

        try {
          const aiResponse = await fetchAIChatCompletion({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
          }, console.log);

          const personalized = JSON.parse(aiResponse.choices[0].message.content);

          return {
            leadId: lead.id,
            subject: personalized.subject,
            content: personalized.content
          };
        } catch (err) {
          console.error(`Error personalizing for lead ${lead.id}:`, err);
          return { leadId: lead.id, error: err.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Lead personalization Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to personalize emails'
    });
  }
});
// --- COMPOSE DIRECT EMAIL ENDPOINT ---
app.post('/api/send-direct-email', async (req, res) => {
  try {
    const { accountId, to, subject, text, html, attachments } = req.body;
    if (!accountId || !to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: account } = await supabase.from('email_accounts').select('*').eq('id', accountId).single();
    if (!account) return res.status(404).json({ error: 'Account not found' });

    let transporter;
    if (account.provider === 'google') {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: account.email, pass: account.app_password }
      });
    } else {
      transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: parseInt(account.smtp_port) || 465,
        secure: true,
        auth: { user: account.email, pass: account.app_password }
      });
    }

    const mailOptions = {
      from: `"${account.name || ''}" <${account.email}>`,
      to,
      subject,
      text,
      html,
      attachments: attachments ? attachments.map(att => ({
        filename: att.name,
        content: att.content,
        encoding: 'base64'
      })) : []
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Log in inbox_emails (optional but good for history)
    await supabase.from('inbox_emails').insert({
      email_account_id: account.id,
      from: `"${account.name || ''}" <${account.email}>`,
      to,
      subject,
      body_text: text,
      body_html: html || text,
      folder: 'sent',
      is_read: true
    });

    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending direct email:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/draft-closing-reply', async (req, res) => {
  try {
    const { lead, thread, companyName, senderName, senderEmail, prompt, campaignId } = req.body;

    if (!lead || !thread) {
      throw new Error('Missing lead or thread data');
    }

    // AUTO-REPLY GATE: Check if the incoming 'reply' is actually an auto-reply
    const threadLower = (thread || '').toLowerCase();
    const autoReplyPatterns = [
      'do not reply', 'this email box is not monitored',
      'this mailbox is not monitored', 'this is an automated response',
      'please do not reply to this email', 'this inbox is not monitored',
      'out of office', 'automatic reply', 'auto-reply'
    ];
    const isAutoReplyThread = autoReplyPatterns.some(p => threadLower.includes(p));
    if (isAutoReplyThread) {
      return res.json({
        success: true,
        draft: null,
        isAutoReply: true,
        message: 'This is an auto-reply — no response needed. Lead should be marked as bounced.'
      });
    }

    // Determine if this is a MrMedic campaign or Relay campaign for tone-appropriate replies
    let isMrMedic = false;
    let isRelay = false;
    let campaignNameLower = '';
    if (campaignId) {
      try {
        const { data: camp } = await supabase.from('campaigns')
          .select('business_id, name').eq('id', campaignId).maybeSingle();
        isMrMedic = camp?.business_id === '0269fe06-4607-4c58-9263-12a3930a1dc3';
        isRelay = camp?.business_id === '102a3bca-7b0a-4cee-bd33-fefd7b4450b4';
        campaignNameLower = (camp?.name || '').toLowerCase();
      } catch (e) { console.warn('Could not determine campaign type:', e.message); }
    }

    let isWebDev = false;
    let isAI = false;
    let isAutomation = false;

    if (isRelay) {
      if (campaignNameLower.includes('web dev') || campaignNameLower.includes('development') || campaignNameLower.includes('website')) {
        isWebDev = true;
      } else if (campaignNameLower.includes('ai') || campaignNameLower.includes('artificial intelligence') || campaignNameLower.includes('machine learning')) {
        isAI = true;
      } else if (campaignNameLower.includes('automation') || campaignNameLower.includes('workflow')) {
        isAutomation = true;
      }
    }

    const leadFirstName = lead.name ? lead.name.split(' ')[0] : 'there';

    let systemPrompt;
    if (isMrMedic) {
      systemPrompt = `You are replying to a lead on behalf of MrMedic Events — a provider of qualified on-site paramedics and nurses for events across London and the Midlands.

CRITICAL TONE RULES:
- Direct and confident, never pushy
- Warm but not informal — professional, not corporate
- Brief — every sentence earns its place
- Short sentences. No fluff. Active voice.
- NEVER use: "synergy", "leverage", "cutting-edge", "bespoke solutions", "world-class", "unrivalled"
- NEVER open with "I hope this email finds you well"
- NEVER mention pricing
- NEVER name competitors
- Max 80 words

OBJECTION HANDLERS:
- "We already have first aid cover" → Ask: "Is that a qualified paramedic or a trained first aider?" Gently note the difference in clinical capability.
- "We can't afford it" → Don't argue price. Ask about their current cover, offer to quote their specific event.
- "We've never needed it" → "That's the ideal position. Our clients who've never had an incident are also the most relieved they had us there."
- "We're too small" → "We regularly cover events from 20 people upwards."
- "Send me more information" → Don't send a brochure. Reply: "Happy to — what's most useful, a quick call or a written quote for your next event?"

INSTRUCTIONS:
1. Read the thread carefully to understand context.
2. Address their specific points directly. Match the MrMedic tone above.
3. Suggest a clear, low-friction next step.
4. GREETING: Start with "Hi ${leadFirstName},"
5. SIGN-OFF: End with:
Best,
${senderName || 'Clara'}
MrMedic Events
mrmedicevents.co.uk
6. Return raw text only.`;
    } else if (isRelay) {
      let roleDesc = "Relay — an agency specializing in modern business solutions.";
      let objectionHandlers = "";
      
      if (isWebDev) {
        roleDesc = "Relay — a high-end web development agency building lightning-fast, beautiful websites and web apps.";
        objectionHandlers = `OBJECTION HANDLERS:
- "We already have a web agency" → Ask: "Are they moving fast enough and delivering premium design?"
- "We don't have the budget right now" → Don't argue price. Ask: "Understood. Is your current site converting as well as it should be?"
- "Send more info" → Reply: "Happy to. Would you prefer a quick 5-min chat or a couple of recent case studies?"`;
      } else if (isAI) {
        roleDesc = "Relay — an AI implementation agency helping businesses deploy custom AI solutions and agents.";
        objectionHandlers = `OBJECTION HANDLERS:
- "AI is too risky/unproven" → Reply: "I completely understand. That's why we start with small, highly-scoped internal tools before touching anything customer-facing."
- "We don't need AI" → Ask: "Fair enough. Are there any bottlenecks in your operations you wish could just be handled automatically?"
- "Send more info" → Reply: "Happy to. Do you have a specific operational challenge in mind, or would you just like to see what's possible?"`;
      } else if (isAutomation) {
        roleDesc = "Relay — a process automation agency helping businesses eliminate manual busywork through smart workflows.";
        objectionHandlers = `OBJECTION HANDLERS:
- "Our processes work fine" → Reply: "Glad to hear it. Out of curiosity, how many hours a week does your team spend on manual data entry or moving data between tools?"
- "We don't have the budget" → Don't argue price. Note that automation often pays for itself in saved labor hours within weeks.
- "Send more info" → Reply: "Happy to send some details. Are you using any specific software stack (like Salesforce, Airtable, etc.) I should tailor this for?"`;
      }

      systemPrompt = `You are replying to a lead on behalf of ${roleDesc}

CRITICAL TONE RULES:
- Direct and confident, never pushy
- Warm but not informal — professional, not corporate
- Brief — every sentence earns its place
- Short sentences. No fluff. Active voice.
- NEVER use: "synergy", "leverage", "cutting-edge", "bespoke solutions", "world-class", "unrivalled"
- NEVER open with "I hope this email finds you well"
- NEVER mention pricing
- Max 80 words

${objectionHandlers}

INSTRUCTIONS:
1. Read the thread carefully to understand context.
2. Address their specific points directly. Match the strict tone rules above.
3. Suggest a clear, low-friction next step.
4. GREETING: Start with "Hi ${leadFirstName},"
5. SIGN-OFF: End with:
Best,
${senderName || 'Me'}
${companyName || 'Relay'}
${senderEmail || ''}
6. Return raw text only.`;
    } else {
      systemPrompt = `You are an expert B2B closer. Your goal is to draft a short, highly-converting email reply to an interested lead.
Instructions:
1. Read the provided Email Thread history carefully to understand the context of their interest or question.
2. Draft a concise, friendly, and human response. Address their specific points directly.
3. Suggest a clear, low-friction next step (e.g. "Worth a quick chat later this week?" or "Can I send over some details?").
4. Keep the tone warm, professional, and peer-to-peer. NO hard selling.
5. GREETING: Start with "Hi ${leadFirstName},"
6. SIGN-OFF: You MUST include a sign-off at the very end formatted EXACTLY like this:
Kind regards,
${senderName || 'Me'}
${companyName || 'Relay Portal'}
${senderEmail || 'hello@example.com'}
+44 7557 331574
7. Return raw text of the drafted email body ONLY. Do not use JSON.`;
    }

    let userPrompt = `Our Company: ${companyName || 'Us'}
Sender Name: ${senderName || 'Me'}
Lead Info: ${leadFirstName} at ${lead.company || 'their company'}`;

    if (prompt && prompt.trim()) {
      userPrompt += `\n\nCRITICAL CUSTOM INSTRUCTIONS FROM USER:\n${prompt.trim()}`;
    }

    userPrompt += `\n\nEmail Thread History:\n${thread}\n\nDraft the reply now (raw text only):`;

    const data = await fetchAIChatCompletion({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, console.log);

    const draft = data.choices[0].message.content.trim();
    res.json({ success: true, draft });
  } catch (error) {
    console.error('Draft Closing Reply Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/send-closing-reply', async (req, res) => {
  try {
    const { leadId, campaignId, accountId, toEmail, subject, content } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await (supabase || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)).auth.getUser(token);
    if (!user || authError) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const scopedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get Account details
    const { data: account } = await scopedSupabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (!account) throw new Error('Email account not found');

    // Safety checks: Block emails for inactive businesses
    const senderEmail = account.email ? account.email.toLowerCase() : '';

    if (campaignId) {
      const { data: campaign } = await scopedSupabase
        .from('campaigns')
        .select('*, businesses(*)')
        .eq('id', campaignId)
        .maybeSingle();

      if (campaign) {
        if (campaign.businesses?.status !== 'active') {
          return res.status(400).json({ success: false, error: `The business "${campaign.businesses?.name || 'Unknown'}" is currently inactive/disabled.` });
        }
      }
    } else {
      // If no campaignId provided, check if the email account belongs to inactive businesses
      const { data: campaignLinks } = await scopedSupabase
        .from('campaign_email_accounts')
        .select('campaign_id, campaigns(id, name, business_id, businesses(id, name, status))')
        .eq('email_account_id', account.id);

      if (campaignLinks && campaignLinks.length > 0) {
        const inactiveCampaigns = campaignLinks.filter(link => link.campaigns?.businesses?.status !== 'active');
        if (inactiveCampaigns.length === campaignLinks.length) {
          return res.status(400).json({ success: false, error: 'The business associated with this email account is currently inactive/disabled.' });
        }
      }
    }

    const { data: decryptedPassword } = await scopedSupabase.rpc('decrypt_password', {
      encrypted_password: account.encrypted_password
    });

    if (!decryptedPassword) throw new Error('Could not decrypt password');

    // Extract domain from sender email for rate limiting
    const senderIdentifier = account.email.toLowerCase();
    if (senderIdentifier) {
      const { data: canSend, error: limitError } = await scopedSupabase.rpc('increment_domain_email_count', {
        p_domain: senderIdentifier,
        p_max_limit: 30 // Default limit is 30 per domain
      });
      
      if (limitError) {
        console.error('Domain limit check error:', limitError);
      } else if (!canSend) {
        throw new Error(`Domain ${senderDomain} has exceeded the max emails per hour (30) allowed. Message will be reattempted later.`);
      }
    }

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: Number(account.smtp_port) === 465,
      auth: { user: account.email, pass: decryptedPassword }
    });

    const finalHtml = content.replace(/\n/g, '<br/>');

    await transporter.sendMail({
      from: account.name ? `"${account.name}" <${account.email}>` : account.email,
      to: toEmail,
      subject: subject,
      html: finalHtml,
      text: content
    });

    // Lead stays as 'interested' so it remains visible in the Closing tab;
    // the campaign sequence will skip it because it checks the 'interested' status

    // Insert to inbox_emails
    await scopedSupabase.from('inbox_emails').insert({
      email_account_id: account.id, folder: 'sent',
      uid: Math.floor(Math.random() * 1000000000),
      from: account.email, to: toEmail,
      subject: subject, body_text: content, body_html: finalHtml,
      received_at: new Date().toISOString(),
      is_read: true, campaign_id: campaignId,
      sequence_step: 'Closing Reply'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Send Closing Reply Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/email-accounts/:id/test-design', async (req, res) => {
  try {
    const { id } = req.params;
    const { templateName, toEmail } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const scopedSupabase = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: account, error: accountError } = await scopedSupabase
      .from('email_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (accountError) {
      console.error('Supabase fetch error for email_account:', accountError);
      throw new Error(`DB Error: ${accountError.message}`);
    }
    if (!account) throw new Error('Email account not found');

    const { data: decryptedPassword } = await scopedSupabase.rpc('decrypt_password', {
      encrypted_password: account.encrypted_password
    });

    if (!decryptedPassword) throw new Error('Could not decrypt password');

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: Number(account.smtp_port) === 465,
      auth: { user: account.email, pass: decryptedPassword }
    });

    let subject = '';
    let finalHtml = '';

    if (templateName === 'web') {
      subject = 'A quick word about your digital presence';
      finalHtml = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin-bottom: 24px;">Hi there,</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">
          I'll keep this brief. We noticed your current website might not be capturing the full value of your brand. In today's market, a slow or outdated site actively costs you leads.
        </p>
        <p style="font-size: 16px; margin-bottom: 24px;">
          At <strong>Relay</strong>, we build high-end, lightning-fast web experiences designed to convert. No generic templates—just premium, bespoke development that turns visitors into clients.
        </p>
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 8px; color: #ffffff; margin-bottom: 24px; text-align: center;">
          <p style="font-size: 18px; font-weight: 600; margin: 0;">Are you open to a quick 5-minute chat to see what's possible?</p>
        </div>
        <p style="font-size: 16px; margin-bottom: 32px;">
          Best,<br/>
          <strong>${account.name || 'The Relay Team'}</strong><br/>
          Relay Solutions
        </p>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
          <p>You are receiving this email because we believe our services can help your business grow.</p>
          <p><a href="#" style="color: #3b82f6; text-decoration: none;">Unsubscribe</a> from future communications.</p>
        </div>
      </div>
      `;
    } else if (templateName === 'ai') {
      subject = 'Automating your most time-consuming workflows';
      finalHtml = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #e2e8f0; line-height: 1.6; background-color: #0f172a; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);">
        <h2 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-bottom: 24px;">Hi there,</h2>
        <p style="font-size: 16px; margin-bottom: 20px; color: #cbd5e1;">
          How many hours does your team spend on manual data entry, scheduling, or repetitive admin tasks every week?
        </p>
        <p style="font-size: 16px; margin-bottom: 24px; color: #cbd5e1;">
          At <strong>Relay</strong>, we specialize in building custom AI agents and workflow automations that eliminate busywork. We help businesses operate faster, leaner, and with fewer errors.
        </p>
        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
          <p style="font-size: 18px; font-weight: 600; margin: 0; color: #60a5fa;">Would you be open to exploring how AI could streamline your operations?</p>
        </div>
        <p style="font-size: 16px; margin-bottom: 32px; color: #cbd5e1;">
          Best,<br/>
          <strong style="color: #ffffff;">${account.name || 'The Relay Team'}</strong><br/>
          Relay Solutions
        </p>
        <div style="border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
          <p>You are receiving this email because we believe our AI services can significantly improve your efficiency.</p>
          <p><a href="#" style="color: #60a5fa; text-decoration: none;">Opt-out</a> of future emails.</p>
        </div>
      </div>
      `;
    }

    await transporter.sendMail({
      from: account.name ? `"${account.name}" <${account.email}>` : account.email,
      to: toEmail,
      subject: subject,
      html: finalHtml,
      text: finalHtml.replace(/<[^>]*>?/gm, '')
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Test Design Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/verify-smtp', async (req, res) => {
  try {
    const { host, port, email, password } = req.body;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Number(port) === 465,
      auth: {
        user: email,
        pass: password,
      },
    });

    await transporter.verify();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    });
  }
});

app.post('/api/verify-imap', async (req, res) => {
  try {
    const { host, port, email, password } = req.body;

    const client = new ImapFlow({
      host,
      port: Number(port),
      secure: Number(port) === 993,
      auth: {
        user: email,
        pass: password,
      },
      greetingTimeout: 15000,
      tls: { rejectUnauthorized: false },
      logger: false
    });

    await client.connect();
    await client.logout();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'IMAP verification failed'
    });
  }
});

import { scrapeGoogleMaps, scrapeLinkedIn, scrapeGeneralSearch, performDeepResearch, scrapeWithHermes, scrapeCompaniesHouse, scrapeBingMaps, scrapeYell, scrapeIndeed, scrapeEmployerWebsites } from './scraper.mjs';

// User-specific stores for live updates
const userLogs = new Map();
const userResults = new Map();
const activeScrapes = new Map(); // stores { status: 'running' | 'paused' | 'canceled' }

app.get('/api/scraper-active', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json({ active: false, status: 'idle' });

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.json({ active: false, status: 'idle' });

    const activeRun = Array.from(activeScrapes.values()).find(s => s.userId === user.id && s.status !== 'canceled');
    if (!activeRun) {
      res.json({ active: false, status: 'idle' });
    } else {
      res.json({ active: true, status: activeRun.status });
    }
  } catch (e) {
    res.json({ active: false, status: 'idle' });
  }
});

app.post('/api/scraper-pause', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false });
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      // Pause all active runs for this user
      for (const [rid, state] of activeScrapes.entries()) {
        if (state.userId === user.id) {
          activeScrapes.set(rid, { ...state, status: 'paused' });
        }
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/scraper-resume', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false });
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      // Resume all active runs for this user
      for (const [rid, state] of activeScrapes.entries()) {
        if (state.userId === user.id) {
          activeScrapes.set(rid, { ...state, status: 'running' });
        }
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/scraper-cancel', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false });
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      // Cancel all active runs for this user
      for (const [rid, state] of activeScrapes.entries()) {
        if (state.userId === user.id) {
          activeScrapes.set(rid, { ...state, status: 'canceled' });
        }
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/scraper-logs', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json([]);

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.json([]);

    // Fetch from database for persistence
    const { data: dbLogs, error: dbError } = await supabase
      .from('scraper_logs')
      .select('timestamp, message')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(200);

    const memLogs = userLogs.get(user.id) || [];
    let combined = [...memLogs];

    if (!dbError && dbLogs && dbLogs.length > 0) {
      const dbArr = dbLogs.reverse().map(l => ({
        timestamp: l.timestamp,
        message: l.message
      }));
      // Merge and deduplicate by message+timestamp
      const seen = new Set(memLogs.map(m => m.timestamp + m.message));
      for (const d of dbArr) {
        if (!seen.has(d.timestamp + d.message)) {
          combined.push(d);
        }
      }
    }
    
    // Sort combined by timestamp ascending
    combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json(combined.slice(-200));
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/scraper-results', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json([]);

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.json([]);

    const results = userResults.get(user.id) || [];
    console.log(`[API] Serving ${results.length} leads to user ${user.id}.`);
    res.json(results);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/deep-research', async (req, res) => {
  try {
    const { company, website, notesContext, leadId } = req.body;
    if (!company) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    // Use the new comprehensive research pipeline
    const { researchAndSummarizeLead } = await import('./research_helper.mjs');
    
    const mockLead = {
      id: leadId || 'manual-research',
      company,
      website: website || '',
      name: company,
      email: '',
    };

    const result = await researchAndSummarizeLead(mockLead, console.log, notesContext || '');

    // If a leadId was provided, save the results to the database
    if (leadId && supabase) {
      const updatePayload = {
        summary: result.summary,
        research_status: result.status,
        research_score: result.research_score || 0,
        research_data_raw: result.research_data_raw || null,
        researched_at: new Date().toISOString(),
        research_attempts: 0,
        updated_at: new Date().toISOString()
      };

      if (result.structured) {
        const s = result.structured;
        updatePayload.company_description = s.company_description || null;
        updatePayload.company_size = s.company_size || null;
        updatePayload.annual_revenue = s.annual_revenue || null;
        updatePayload.year_founded = s.year_founded || null;
        updatePayload.key_people = s.key_people && s.key_people.length > 0 ? s.key_people : [];
        updatePayload.tech_stack = s.tech_stack && s.tech_stack.length > 0 ? s.tech_stack : [];
        updatePayload.pain_points = s.pain_points && s.pain_points.length > 0 ? s.pain_points : [];
        updatePayload.recent_news = s.recent_news && s.recent_news.length > 0 ? s.recent_news : [];
        updatePayload.social_presence = s.social_presence || {};
        updatePayload.services_offered = s.services_offered && s.services_offered.length > 0 ? s.services_offered : [];
        updatePayload.target_market = s.target_market || null;
        updatePayload.competitive_advantage = s.competitive_advantage || null;
        updatePayload.growth_signals = s.growth_signals && s.growth_signals.length > 0 ? s.growth_signals : [];
      }

      await supabase.from('leads').update(updatePayload).eq('id', leadId);
    }

    res.json({ 
      success: true, 
      data: result.summary,
      structured: result.structured || null,
      research_score: result.research_score || 0,
      status: result.status
    });
  } catch (error) {
    console.error('Deep Research API Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Deep Research failed'
    });
  }
});

// Get full enriched lead intelligence data
app.get('/api/lead-intelligence/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Lead ID is required' });
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    console.error('Lead Intelligence API Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lead intelligence'
    });
  }
});

// Trigger re-research for a specific lead
app.post('/api/re-research/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Lead ID is required' });
    }

    // Reset research status so the cron picks it up
    const { error } = await supabase
      .from('leads')
      .update({
        research_status: null,
        research_attempts: 0,
        research_score: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Lead queued for re-research' });
  } catch (error) {
    console.error('Re-Research API Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue re-research'
    });
  }
});

app.post('/api/generate-test-lead', async (req, res) => {
  try {
    const { niche, name, email } = req.body;

    if (!niche) {
      return res.status(400).json({ success: false, error: 'Niche is required' });
    }

    const systemPrompt = `You are an AI assistant that generates realistic mock B2B lead data for software testing.
The user will provide a "niche" or industry. You must generate a highly realistic, fictional company and lead profile that perfectly fits this niche.

Rules:
1. The company and data MUST be entirely fictional but highly realistic.
2. The "summary" field MUST be a detailed mock research report formatted in Markdown, containing a "⚡ Quick Summary" and a "🔬 Deep Research" section with "Company Overview", "Key Pain Points", and "Social Proof".
3. The "personalized_email" field MUST be a realistic draft intro email to this person.
   - Tone: Genuinely warm, relaxed, and NOT pushy or salesy at all. Think "friendly peer who's here to help, no pressure". 
   - Do NOT use aggressive CTAs like "Book a call" or "Are you free Tuesday?". Instead, just leave the door open casually (e.g. "If you ever want to chat about X, I'm here.").
   - The email should feel like the sender genuinely cares about the lead's success and is happy to leave them to it.
   - Keep it short, conversational, and human.
   - You CAN reference pain points from the research notes naturally, but do NOT phrase it as if the lead personally told you or is "thinking about" it. Frame observations as things you've noticed in the industry or their niche, not as assumptions about their internal thoughts.
   - End with a placeholder signature block: {ender}\\n<company>\\n\\n[Sender Name]\\n[Email]\\n[Phone].
   - Do NOT use the lead's full name in the greeting, only first name.
4. Output MUST be valid JSON with the exact keys specified below. Do not use markdown blocks for the JSON, return raw JSON string.

Schema:
{
  "company": "Fictional Company Name",
  "title": "Realistic Job Title",
  "industry": "Specific Sub-Industry",
  "summary": "Mock deep research report in Markdown",
  "personalized_email": "Mock intro email draft",
  "phone": "Fictional Phone Number",
  "location": "Realistic City, State/Country"
}`;

    const userPrompt = `Generate a realistic test lead profile for the niche: "${niche}".
The lead's name is "${name || 'John Doe'}" and email is "${email || 'john@example.com'}".`;

    const data = await fetchAIChatCompletion({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    }, console.log);

    const leadData = JSON.parse(data.choices[0].message.content);
    res.json({ success: true, data: leadData });

  } catch (error) {
    console.error('Test Lead Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate test lead'
    });
  }
});

// Intelligent Query Translator: Convert abstract niches to Google Maps-searchable terms
async function translateToMapQueries(business, location, log) {
  const prompt = `Convert this business niche into 3-5 Google Maps search terms that return REAL business listings.
We want to target local, independent, or boutique businesses that are likely to have manual process bottlenecks (like manual stock counts, manual booking scheduling, or manual invoicing).

NICHE: "${business}"
LOCATION: "${location || 'UK'}"

RULES:
- Google Maps indexes BUSINESS TYPES, not abstract concepts.
- Use terms people actually search on Google Maps.
- Focus on independent, local, family-run, or boutique variations of the business type to avoid national chains or massive corporate franchises.
- Good search term examples: "independent restaurant", "boutique hotel", "family run cafe", "local florist", "local plumbing contractor".
- Bad search term examples: "restaurant chain", "AI automation", "lead generation", "hotel franchise".
- Return ONLY a JSON array of strings, nothing else.

Example: "Restaurant" → ["independent restaurant", "bistro", "family run restaurant", "local cafe"]`;

  try {
    const res = await fetchAIChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    }, log);
    const content = res.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const queries = JSON.parse(jsonMatch[0]);
      if (Array.isArray(queries) && queries.length > 0) {
        log(`[Query Translator] "${business}" → [${queries.join(', ')}]`);
        return queries;
      }
    }
  } catch (e) {
    log(`[Query Translator] Failed, using original: ${e.message}`);
  }
  return [business];
}

app.post('/api/scrape-leads', async (req, res) => {
  let userId = null;
  try {
    try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] Scrape API Called. Body: ${JSON.stringify(req.body)}\n`); } catch (e) { }

    let { platforms = {}, business, location, countryCode, keywords, notesContext, deepResearch = false, limit = 20, campaignId, taskId } = req.body;
    
    // Sanitization: Remove "undefined" strings that might be passed by AI
    if (business === 'undefined' || !business) business = keywords || null;
    if (location === 'undefined') location = null;
    
    if (!business) {
      return res.status(400).json({ success: false, message: 'Missing business/niche parameter. Cannot scrape without a target.' });
    }
    
    if (Object.keys(platforms).length === 0) {
      platforms.google = true;
      platforms.companieshouse = true;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] Failed: Missing authHeader\n`); } catch (e) { }
      return res.status(401).json({ success: false, error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const client = supabase || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await client.auth.getUser(token);

    if (authError || !user) {
      // Internal Bypass: allow if token matches anon/service key (used by agents)
      if (token === process.env.SUPABASE_ANON_KEY || token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('[Scraper] Bypassing auth for internal system request');
        userId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643'; // Default to admin user
      } else {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    } else {
      userId = user.id;
    }

    // Concurrency Lock Check: Reject duplicate active scrapes for the same campaign
    if (campaignId) {
      try {
        let query = client
          .from('tasks')
          .select('id, description')
          .eq('assigned_to', 'Scraper')
          .in('status', ['in_progress', 'pending', 'waiting']);
        
        if (taskId) {
          query = query.neq('id', taskId);
        }
        
        const { data: activeTasks, error: taskCheckErr } = await query;
        
        if (!taskCheckErr && activeTasks) {
          const isAlreadyRunning = activeTasks.some(t => t.description && t.description.includes(campaignId));
          if (isAlreadyRunning) {
            console.log(`[Scraper API] Duplicate scrape rejected: Campaign ${campaignId} is already being scraped.`);
            return res.status(409).json({ success: false, message: `Scraper is already running for campaign ${campaignId}.` });
          }
        }
      } catch (err) {
        console.error('[Scraper API] Error checking active tasks:', err.message);
      }
    }

    // Global Concurrency Limiter: Push Hetzner Node to max capacity
    // Allow up to 8 concurrent campaigns to be scraped at any given time.
    if (activeScrapes.size >= 8) {
      console.log(`[Scraper API] Server busy: ${activeScrapes.size} active scrapes running. Rejecting new request.`);
      return res.status(429).json({ success: false, message: 'Server is currently at maximum scraping capacity. Please try again later.' });
    }

    // Initialize user-specific stores
    userLogs.set(userId, []);
    userResults.set(userId, []);
    const runId = Date.now().toString();
    activeScrapes.set(runId, { status: 'running', userId });

    // Respond immediately - scrape runs in background, frontend polls for updates
    res.json({ success: true, message: 'Scrape started' });

    // Ensure Folder and List exist for categorization
    let listId = null;
    let campaignName = 'Unknown Campaign';
    let campaignPitch = '';
    let campaignLeadCount = 0;
    try {
      if (campaignId) {
        const { data: campaignData } = await client.from('campaigns').select('name, pitch, objective').eq('id', campaignId).single();
        if (campaignData) {
          campaignName = campaignData.name;
          campaignPitch = campaignData.pitch || campaignData.objective || '';
        }
        const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId);
        campaignLeadCount = count || 0;
      }

      const folderName = business || 'General';
      const { data: folder, error: folderErr } = await client.from('list_folders').upsert({
        user_id: userId,
        name: folderName
      }, { onConflict: 'user_id,name' }).select().single();
      
      if (folderErr) console.error('[Scraper] Folder creation failed:', folderErr.message);

      const listName = `${location || 'Global'} - ${new Date().toLocaleDateString()} (${business || 'Leads'})`;
      const { data: list, error: listErr } = await client.from('saved_lists').upsert({
        user_id: userId,
        name: listName,
        folder_id: folder?.id
      }, { onConflict: 'user_id,name' }).select().single();
      
      if (listErr) console.error('[Scraper] List creation failed:', listErr.message);

      if (list) {
        listId = list.id;
        console.log(`[Scraper] Successfully established saved_list ${listId} ("${listName}") in folder ${folder?.id}`);
      }
    } catch (e) { console.error('[Scraper] Folder/List creation failed:', e.message); }

    // Initialize persistent broadcast channels
    const scrapeChannel = client.channel(`scraped-leads-${userId}`);
    const campaignChannel = campaignId ? client.channel(`campaign-scraper-${campaignId}`) : null;

    const setupChannel = (chan) => {
      if (!chan) return;
      chan.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          chan.send({
            type: 'broadcast',
            event: 'scrape-status',
            payload: { status: 'running', runId }
          });
        }
      });
    };

    setupChannel(scrapeChannel);
    setupChannel(campaignChannel);

    const log = async (message) => {
      const timestamp = new Date().toISOString();
      console.log(`[Scraper] ${message}`);
      
      try { 
        const epLogPath = 'scraper_endpoint.log';
        if (fs.existsSync(epLogPath) && fs.statSync(epLogPath).size > 5 * 1024 * 1024) {
          fs.writeFileSync(epLogPath, `[${timestamp}] [Log Rotated - 5MB Limit Reached]\n`);
        }
        fs.appendFileSync(epLogPath, `[${timestamp}] [Scraper] ${message}\n`); 
      } catch (e) { }

      // Persistence store
      try {
        // Only save major milestone logs to the DB to reduce write pressure
        if (message.includes('Starting scrape') || message.includes('Scraping Complete') || message.includes('Reached limit') || message.includes('Linked lead')) {
          await client.from('scraper_logs').insert({
            user_id: userId,
            message: message,
            timestamp: timestamp
          });
        }

        // REMOVED chat_logs broadcast to prevent dashboard spam
      } catch (e) {
        console.error('Failed to save log to DB:', e.message);
      }

      // Broadcast real-time log to UI
      const payload = { timestamp, message };
      
      const logs = userLogs.get(userId) || [];
      logs.push(payload);
      if (logs.length > 200) logs.shift();
      userLogs.set(userId, logs);

      scrapeChannel.send({
        type: 'broadcast',
        event: 'scrape-log',
        payload
      });

      if (campaignChannel) {
        campaignChannel.send({
          type: 'broadcast',
          event: 'scrape-log',
          payload
        });
      }
    };
    let totalLeadsInThisRun = 0;

    const onResult = async (lead) => {
      // Throttle lead processing by 1.5 seconds per lead for accuracy
      await new Promise(r => setTimeout(r, 1500));

      // PRE-INSERTION AI RESEARCH: Always run synchronous AI research before saving to DB
      let researchSummary = lead.summary || '';
      let researchStatus = lead.research_status || 'completed';
      let structuredData = {};
      const hasEmail = lead.email && lead.email.trim() !== '';
      
      if (!researchSummary || researchSummary.length < 20) {
        try {
          log(`[Deep Research] Running synchronous pre-insertion AI research for ${lead.company || lead.name}...`);
          const res = await researchAndSummarizeLead(lead, log, campaignPitch);
          researchSummary = res.summary;
          researchStatus = res.status || 'completed';
          if (res.structured) {
            structuredData = res.structured;
            // Remove duplicates from structuredData that shouldn't override basic lead data
            delete structuredData.personalised_detail;
            delete structuredData.quick_fact;
          }
        } catch (err) {
          log(`[Deep Research] Research error for ${lead.company || 'lead'}: ${err.message}. Using baseline detail.`);
          researchSummary = `## ⚡ Personalised Detail\nwork\n\n## 🔬 Quick Fact\nNo specific details found.`;
          researchStatus = 'completed';
        }
      }
      
      // REGIONAL INTEGRITY FILTER: Prevent international "leaks" for US-focused campaigns
      const isUsTarget = countryCode === 'US' || 
                         (location && /usa|united states|,\s*us$|,\s*tx$|,\s*ca$|,\s*ny$|,\s*fl$|,\s*il$|,\s*pa$|,\s*oh$|,\s*ga$|,\s*nc$|,\s*mi$|,\s*nj$|,\s*va$|,\s*wa$|,\s*az$|,\s*ma$|,\s*tn$|,\s*in$|,\s*mo$|,\s*md$|,\s*wi$|,\s*co$|,\s*mn$|,\s*sc$|,\s*al$|,\s*la$|,\s*ky$|,\s*or$|,\s*ok$|,\s*ct$|,\s*ut$|,\s*ia$|,\s*nv$|,\s*ar$|,\s*ms$|,\s*ks$|,\s*nm$|,\s*ne$|,\s*id$|,\s*wv$|,\s*nh$|,\s*me$|,\s*mt$|,\s*ri$|,\s*sd$|,\s*nd$|,\s*vt$|,\s*ak$|,\s*hi$/i.test(location.trim()));
      
      if (isUsTarget) {
        const website = (lead.website || '').toLowerCase();
        const email = (lead.email || '').toLowerCase();
        // Mandated TLD filtering: Discard non-US extensions
        const internationalTLDs = ['.de', '.uk', '.fr', '.it', '.es', '.nl', '.cn', '.ru', '.br', '.au', '.ca', '.in', '.jp', '.kr', '.mx', '.se', '.no', '.fi', '.dk', '.ch', '.at', '.be'];
        
        const isInternational = internationalTLDs.some(tld => 
          website.endsWith(tld) || website.includes(tld + '/') || email.endsWith(tld)
        );

        if (isInternational) {
          log(`[Filter] Dropped ${lead.company}: International TLD detected (${website || email}) while targeting US.`);
          return;
        }
      }
      
      const results = userResults.get(userId) || [];
      try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] onResult called for ${lead.company}. Email: ${lead.email}\n`); } catch (e) { }
      const exists = results.some(r => (r.website && r.website === lead.website) || (r.email && r.email === lead.email));

      if (!exists) {
        if (lead.email) {
          try {
            const { data: blacklisted } = await client.from('global_blacklist').select('id').ilike('email', lead.email).maybeSingle();
            if (blacklisted) {
                log(`[Filter] Dropped ${lead.company}: Email is globally blacklisted.`);
                return;
            }
            
            // Filter out leads that are already scraped or don't have valid emails
            const { data: existingLead } = await client.from('leads').select('id, status').ilike('email', lead.email).maybeSingle();
            
            if (existingLead) {
              log(`[Scraper] Lead ${lead.email} already exists in DB. Skipping new insert, but will link to campaign if needed.`);
              if (campaignId) {
                await client.from('campaign_leads').upsert({
                  campaign_id: campaignId,
                  lead_id: existingLead.id
                }, { onConflict: 'campaign_id,lead_id' });
                
                campaignLeadCount++;
                if (campaignLeadCount === 1) {
                  log(`[Scraper] Campaign ${campaignName} reached first lead. Triggering automated sequence generation...`);
                  generateAndSaveSequencesForCampaign(campaignId, false); // generate without pausing
                } else if (campaignLeadCount > 1) {
                  ensureCampaignSchedules(campaignId);
                }
              }
              
              if (scrapeChannel) scrapeChannel.send({ type: 'broadcast', event: 'leads_updated', payload: {} });
              if (campaignChannel) campaignChannel.send({ type: 'broadcast', event: 'metrics_updated', payload: {} });
              
              return;
            }

            if (existingLead && ['bounced', 'closed', 'interested', 'client', 'converted'].includes(existingLead.status.toLowerCase())) {
                log(`[Filter] Dropped ${lead.company}: Lead already exists with terminal status (${existingLead.status}).`);
                return;
            }
          } catch (e) {
            console.error('[Scraper] DB check error:', e.message);
          }
        }
        
        totalLeadsInThisRun++;
        results.push(lead);
        userResults.set(userId, results);
        console.log(`[Main Server] Added lead for ${userId}: ${lead.company}`);

        // Update Progress in Factory UI
        if (taskId) {
          const progress = Math.min(Math.round((results.length / limit) * 100), 99);
          client.from('tasks').update({ progress }).eq('id', taskId).then(({error}) => {
            if (error) console.error('Error updating progress:', error.message);
          });
        }

        // Mark leads without email as invalid so they are filtered out
        const validationStatus = !hasEmail ? 'invalid' : (lead.validation_status || null);
        const validationDetails = !hasEmail ? 'No email found during scrape' : (lead.validation_details || null);

        const leadData = {
          user_id: userId,
          company: lead.company || '',
          email: lead.email || '',
          website: lead.website || '',
          location: lead.location || '',
          phone: lead.phone || '',
          summary: researchSummary || lead.summary || '',
          source: lead.source || 'scraped',
          status: 'new',
          facebook: lead.facebook || '',
          twitter: lead.twitter || '',
          instagram: lead.instagram || '',
          role: lead.role || '',
          name: (lead.name && lead.name.trim() && lead.name.trim().toLowerCase() !== 'unknown') ? lead.name.trim() : (lead.company || ''),
          research_status: researchStatus,
          tech_stack: lead.tech_stack || [],
          services_offered: lead.services_offered || [],
          industry: lead.industry || business || keywords || null,
          social_presence: {
            facebook_url: lead.facebook || '',
            instagram_url: lead.instagram || '',
            twitter_url: lead.twitter || '',
            linkedin_url: lead.linkedin || '',
            google_rating: null,
            review_count: null
          },
          ...structuredData,
          // Prioritize direct statutory metadata (e.g. from Companies House) over AI deductions
          company_size: lead.company_size || structuredData.company_size || null,
          annual_revenue: lead.annual_revenue || structuredData.annual_revenue || null,
          year_founded: lead.year_founded || structuredData.year_founded || null,
          research_score: res?.research_score || 0,
          validation_status: validationStatus,
          validation_details: validationDetails,
          updated_at: new Date().toISOString()
        };

        // Validate lead data completeness (must not lack more than 3 core fields)
        const missingFields = [];
        if (!leadData.email) missingFields.push('email');
        if (!leadData.phone) missingFields.push('phone');
        if (!leadData.website) missingFields.push('website');
        if (!leadData.industry) missingFields.push('industry');
        if (!leadData.company_size) missingFields.push('company_size');
        if (!leadData.year_founded) missingFields.push('year_founded');
        if (!leadData.annual_revenue) missingFields.push('annual_revenue');
        if (!leadData.tech_stack || leadData.tech_stack.length === 0) missingFields.push('tech_stack');
        if (!leadData.services_offered || leadData.services_offered.length === 0) missingFields.push('services_offered');
        
        const hasSocial = leadData.social_presence && (
          leadData.social_presence.facebook_url || 
          leadData.social_presence.instagram_url || 
          leadData.social_presence.twitter_url || 
          leadData.social_presence.linkedin_url
        );
        if (!hasSocial) missingFields.push('social_presence');

        if (missingFields.length > 3) {
          log(`[Filter] Dropped ${lead.company || 'lead'}: Lacked too many fields (${missingFields.length} missing: ${missingFields.join(', ')}). Only a maximum of 3 empty fields are allowed.`);
          return;
        }

        // Use a retry mechanism for DB saves
        let error, upsertedData;
        let dbRetries = 0;
        while (dbRetries < 3) {
          try {
            const result = await client
              .from('leads')
              .upsert(leadData, {
                onConflict: 'user_id,website,email',
                ignoreDuplicates: false
              })
              .select()
              .single();
            
            error = result.error;
            upsertedData = result.data;
            
            if (!error) break;
            if (!error.message?.includes('fetch failed') && !error.message?.includes('timeout')) break;
          } catch (e) {
            if (dbRetries === 2) console.error('[Main Server] Final DB Retry Failed:', e.message);
          }
          dbRetries++;
          await new Promise(r => setTimeout(r, 2000 * dbRetries)); // Exponential backoff
        }

        if (error) {
          console.error('[Main Server] Error saving lead to DB:', error.message);
          try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] DB Error saving lead: ${error.message}\n`); } catch (e) { }
        } else if (upsertedData) {
          // Save to local file system for manual/future use
          try {
            const savedListsDir = path.resolve(__dirname, '../../../backend/saved_lists');
            const niche = lead.niche || lead.industry || campaignName || business || 'general';
            const nicheDir = path.join(savedListsDir, niche.replace(/[^a-z0-9]/gi, '_').toLowerCase());
            
            if (!fs.existsSync(nicheDir)) {
              fs.mkdirSync(nicheDir, { recursive: true });
            }

            const safeName = (lead.company || 'lead').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filePath = path.join(nicheDir, `${safeName}_${Date.now()}.json`);
            fs.writeFileSync(filePath, JSON.stringify(leadData, null, 2));
            
            // Also append to a master list for that niche
            const masterPath = path.join(nicheDir, `_master_list.json`);
            let masterList = [];
            if (fs.existsSync(masterPath)) {
              try {
                masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
              } catch (e) {
                masterList = [];
              }
            }
            // Check for duplicates in master list
            if (!masterList.some(l => l.email === leadData.email)) {
              masterList.push(leadData);
              fs.writeFileSync(masterPath, JSON.stringify(masterList, null, 2));
            }
          } catch (fsErr) {
            console.error('[Main Server] Error saving lead to local filesystem:', fsErr.message);
          }

          // If campaignId is provided, link lead to campaign
          if (campaignId) {
            try {
              await client
                .from('campaign_leads')
                .upsert({
                  campaign_id: campaignId,
                  lead_id: upsertedData.id
                }, { onConflict: 'campaign_id,lead_id' });
              log(`Linked lead ${upsertedData.company} to campaign: ${campaignName}`);

              campaignLeadCount++;
              if (campaignLeadCount === 1) {
                log(`[Scraper] Campaign ${campaignName} reached first lead. Triggering automated sequence generation...`);
                generateAndSaveSequencesForCampaign(campaignId, false); // generate without pausing
              } else if (campaignLeadCount > 1) {
                ensureCampaignSchedules(campaignId);
              }
              
              // Update Campaign Stats every 10 leads to avoid overloading DB
              if (totalLeadsInThisRun % 10 === 0) {
                const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId);
                await client.from('campaigns').update({ prospects: count || totalLeadsInThisRun }).eq('id', campaignId);
              }
            } catch (linkErr) {
              console.error('[Main Server] Error linking lead to campaign:', linkErr.message);
            }
          }

          if (scrapeChannel) scrapeChannel.send({ type: 'broadcast', event: 'leads_updated', payload: {} });
          if (campaignChannel) campaignChannel.send({ type: 'broadcast', event: 'metrics_updated', payload: {} });

          // Link to the newly created list
          if (listId) {
            try {
              await client.from('list_leads').upsert({
                list_id: listId,
                lead_id: upsertedData.id
              }, { onConflict: 'list_id,lead_id' });
            } catch (listLinkErr) {
              console.error('[Main Server] Error linking lead to list:', listLinkErr.message);
            }
          }

          // Explicitly broadcast the new lead
          const channel = client.channel(`scraped-leads-${userId}`);
          const cChannel = campaignId ? client.channel(`campaign-scraper-${campaignId}`) : null;
          
          const bPayload = { 
            type: 'broadcast',
            event: 'new-lead',
            payload: upsertedData
          };

          await channel.send(bPayload);
          if (cChannel) await cChannel.send(bPayload);
          
          client.removeChannel(channel);
          if (cChannel) client.removeChannel(cChannel);
        }
      }
    };

    // Run scraping in background
    (async () => {
      await executionQueue.enqueue(async () => {
      const MAX_RETRIES = 3;
      let currentRetry = 0;
      let currentTaskId = taskId;

      try {
        while (currentRetry < MAX_RETRIES) {
          try {
          if (!currentTaskId) {
            const description = `Scraping ${business} in ${location || 'multiple locations'}` + (campaignId ? ` [Campaign: ${campaignId}]` : '');
            const { data: taskData } = await client.from('tasks').insert([{
              assigned_to: 'Scraper',
              description,
              status: 'in_progress',
              progress: 0
            }]).select().single();
            if (taskData) currentTaskId = taskData.id;
          } else {
             if (taskId) {
              try {
                const description = `Starting autonomous scrape for ${business || keywords} in ${location}...` + (campaignId ? ` [Campaign: ${campaignId}]` : '');
                await client
                  .from('tasks')
                  .update({
                    status: 'in_progress',
                    description
                  })
                  .eq('id', taskId);
              } catch (err) {
                console.error('[Scraper] Failed to update task status:', err.message);
              }
            }
          }

          let scrapeLocations = [];
          
          if (currentRetry > 0) {
            log(`[RETRY ${currentRetry}/${MAX_RETRIES}] Previous attempt found 0 leads. Retrying with broader search...`);
          }

        // --- HISTORY TRACKING (PostgreSQL) ---
        const getScrapedCities = async (uid, bns, cCode) => {
          try {
            const { data, error } = await client
              .from('scrape_history')
              .select('location')
              .eq('user_id', uid)
              .eq('business_type', (bns || '').trim().toLowerCase())
              .eq('country_code', (cCode || '').trim().toLowerCase());

            if (error) throw error;
            return data.map(row => row.location);
          } catch (e) {
            console.error('Error fetching scrape history from DB:', e);
            return [];
          }
        };

        const markCityScraped = async (uid, bns, cCode, loc) => {
          try {
            await client.from('scrape_history').insert({
              user_id: uid,
              business_type: (bns || '').trim().toLowerCase(),
              country_code: (cCode || '').trim().toLowerCase(),
              location: loc
            });
          } catch (e) { console.error('Error saving scrape history to DB:', e); }
        };

        const ignoreHistory = req.body.ignoreHistory === true || req.body.deep === true;
        
        let normalizedLocation = location;
        if (normalizedLocation) {
            const locLower = normalizedLocation.trim().toLowerCase();
            if (locLower === 'united kingdom' || locLower === 'uk' || locLower === 'great britain' || locLower === 'gb') {
                countryCode = 'GB';
                normalizedLocation = '';
            } else if (locLower === 'united states' || locLower === 'us' || locLower === 'usa' || locLower === 'america') {
                countryCode = 'US';
                normalizedLocation = '';
            }
        }

        if (countryCode && !normalizedLocation) {
          log(`Broad country search for ${countryCode}. Prioritizing major cities and surrounding areas.`);
          const countryCities = City.getCitiesOfCountry(countryCode) || [];
          
          const MAJOR_GB_CITIES = [
            "London", "Birmingham", "Manchester", "Glasgow", "Newcastle upon Tyne", 
            "Leeds", "Liverpool", "Nottingham", "Sheffield", "Bristol", 
            "Belfast", "Leicester", "Edinburgh", "Coventry", "Cardiff", 
            "Hull", "Bradford", "Stoke-on-Trent", "Wolverhampton", "Plymouth", 
            "Southampton", "Reading", "Derby", "Dundee", "Aberdeen", 
            "Portsmouth", "York", "Northampton", "Norwich", "Luton"
          ];

          const MAJOR_US_CITIES = [
            "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", 
            "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", 
            "Austin", "Jacksonville", "San Francisco", "Columbus", "Indianapolis", 
            "Fort Worth", "Charlotte", "Seattle", "Denver", "El Paso", 
            "Washington", "Boston", "Detroit", "Nashville", "Memphis", 
            "Portland", "Oklahoma City", "Las Vegas", "Louisville"
          ];

          const majorNames = countryCode === 'GB' ? MAJOR_GB_CITIES : countryCode === 'US' ? MAJOR_US_CITIES : [];
          
          let prioritized = [];
          let others = [];
          
          for (const c of countryCities) {
            const cityName = c.name;
            const fullCityStr = `${cityName}, ${c.stateCode || ''}, ${countryCode}`.replace(/,\s*,/g, ',');
            
            // Check if it's one of the major cities
            if (majorNames.some(m => cityName.toLowerCase() === m.toLowerCase())) {
              prioritized.push(fullCityStr);
            } else {
              others.push(fullCityStr);
            }
          }
          
          // Shuffle prioritized
          for (let i = prioritized.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [prioritized[i], prioritized[j]] = [prioritized[j], prioritized[i]];
          }
          
          // Shuffle others
          for (let i = others.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [others[i], others[j]] = [others[j], others[i]];
          }
          
          // Combine prioritized first, then others (picking 30 total)
          const allCities = [...prioritized, ...others];
          scrapeLocations = allCities.slice(0, 30);
        } else if (normalizedLocation) {
          const tokens = normalizedLocation.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
          const parsedLocs = [];
          for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const lowerToken = token.toLowerCase();
            const isSuffix = ['uk', 'usa', 'us', 'england', 'midlands', 'london', 'united kingdom', 'united states'].includes(lowerToken) || /^[a-z]{2}$/i.test(token);
            if (isSuffix && parsedLocs.length > 0) {
              const lastIdx = parsedLocs.length - 1;
              parsedLocs[lastIdx] = `${parsedLocs[lastIdx]}, ${token}`;
            } else {
              parsedLocs.push(token);
            }
          }
          scrapeLocations = parsedLocs.length > 0 ? parsedLocs : ['Unknown'];
        } else {
          scrapeLocations = [countryCode || 'Unknown'];
        }

        // Filter out already scraped locations
        if (!ignoreHistory) {
          const previouslyScraped = await getScrapedCities(userId, business, countryCode);
          const originalCount = scrapeLocations.length;
          scrapeLocations = scrapeLocations.filter(loc => !previouslyScraped.includes(loc));
          log(`History Map: Skipping ${originalCount - scrapeLocations.length} previously scraped locations. ${scrapeLocations.length} locations remaining.`);
          
          if (scrapeLocations.length === 0 && originalCount > 0) {
            log(`ATTENTION: All targeted locations in this set have already been scraped for "${business}".`);
            if (currentRetry > 0) {
               log(`Enabling DEEP SEARCH for retry... ignoring history to find fresh data.`);
               if (countryCode && !location) {
                  const countryCities = City.getCitiesOfCountry(countryCode);
                  scrapeLocations = countryCities.map(c => `${c.name}, ${c.stateCode || ''}, ${countryCode}`.replace(/,\s*,/g, ','));
               } else {
                  scrapeLocations = [location || countryCode || 'Unknown'];
               }
            }
          }
        } else {
          log(`Ignore History enabled. Scanning all ${scrapeLocations.length} targeted locations...`);
        }

        const checkCancelOrPause = async () => {
          let state = activeScrapes.get(runId);
          if (!state || state.status === 'canceled') {
            throw new Error('CANCELED_BY_USER');
          }
          while (state && state.status === 'paused') {
            await new Promise(r => setTimeout(r, 1000));
            state = activeScrapes.get(runId);
            if (!state || state.status === 'canceled') throw new Error('CANCELED_BY_USER');
          }
        };

        log(`Starting scrape for ${business || keywords || 'unspecified niche'}...`);
        if (notesContext) log(`Custom Notes Focus: ${notesContext}`);

        const MAX_CONCURRENT = 2; // Reduced to 2 to prevent server OOM lockup
        const queue = [...scrapeLocations];
        const activePromises = new Set();
        let isCanceled = false;

        let workerIndex = 0;
        const workerUrls = process.env.RENDER_WORKER_URLS ? process.env.RENDER_WORKER_URLS.split(',').map(s=>s.trim()).filter(Boolean) : [];

        log(`Starting concurrent processing across ${queue.length} locations with up to ${MAX_CONCURRENT} active browsers/workers...`);

        // Translate abstract niche to concrete Google Maps-searchable terms
        let translatedQueries = await translateToMapQueries(business || keywords, location, log);
        if (currentRetry > 0) {
          // Broaden queries on retry by adding simpler fallback variants
          const simplerNiche = (business || keywords).split(' ').slice(-1)[0];
          if (simplerNiche && !translatedQueries.includes(simplerNiche)) {
            translatedQueries.push(simplerNiche);
          }
          if (business && !translatedQueries.includes(business)) {
            translatedQueries.push(business);
          }
          log(`[Retry Mode] Broadened search query variants to: [${translatedQueries.join(', ')}]`);
        }
        log(`[Smart Scrape] Will search with ${translatedQueries.length} query variants: [${translatedQueries.join(', ')}]`);

        const processCity = async (currentLoc) => {
          console.log(`--- Scraping City (Concurrent): ${currentLoc} ---`);
          try {
            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            if (currentTaskId) {
              await client.from('tasks').update({ 
                description: `[Scraping] ${business} in ${currentLoc} (${queue.length} left)` 
              }).eq('id', currentTaskId);
            }
            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            const initialLeadCount = userResults.get(userId)?.length || 0;

            // --- WORKER DELEGATION ---
            if (workerUrls.length > 0) {
              const workerUrl = workerUrls[workerIndex % workerUrls.length];
              workerIndex++;
              log(`[Master] Delegating ${currentLoc} to worker: ${workerUrl}`);
              
              // Figure out main platform to request
              let platformReq = 'general';
              if (platforms.google) platformReq = 'google';
              else if (platforms.companieshouse) platformReq = 'companieshouse';
              else if (platforms.bing) platformReq = 'bing';
              else if (platforms.yell) platformReq = 'yell';
              
              const payload = {
                query: business || keywords,
                location: currentLoc,
                limit: Math.max(5, limit - (userResults.get(userId)?.length || 0)),
                platform: platformReq,
                notesContext,
                deepResearch
              };
              
              try {
                const res = await fetch(`${workerUrl.replace(/\/$/, '')}/api/scrape-task`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                  const data = await res.json();
                  if (data.success && data.leads) {
                    log(`[Master] Worker returned ${data.leads.length} leads for ${currentLoc}. Processing them locally...`);
                    for (const lead of data.leads) {
                        await onResult(lead);
                    }
                  }
                } else {
                  log(`[Master] Worker ${workerUrl} returned error status: ${res.status}`);
                }
              } catch (workerErr) {
                 log(`[Master] Worker delegation failed: ${workerErr.message}`);
              }
              
              await markCityScraped(userId, business, countryCode, currentLoc);
              return; // We skip local processing entirely if we delegated it!
            }

            // --- PRIMARY SELECTED PLATFORMS (Local Processing) ---

            if (platforms.google || platforms.all) {
              for (const searchTerm of translatedQueries) {
                if ((userResults.get(userId)?.length || 0) >= limit) break;
                const query = `${searchTerm} in ${currentLoc}`;
                console.log(`[${currentLoc}] Google Maps: "${query}"`);
                const remainingLimit = Math.max(3, limit - (userResults.get(userId)?.length || 0));
                await scrapeGoogleMaps(query, remainingLimit, log, onResult, notesContext, deepResearch, checkCancelOrPause);
              }
            }

            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            if (platforms.linkedin) {
              log(`[${currentLoc}] LinkedIn scraper bypassed: LinkedIn scraping is disabled.`);
            }

            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            if (platforms.companieshouse || platforms.all) {
              log(`[${currentLoc}] Scraping via Companies House...`);
              const remainingLimit = Math.max(5, limit - (userResults.get(userId)?.length || 0));
              const query = `${business || keywords} ${currentLoc}`;
              await scrapeCompaniesHouse(query, remainingLimit, log, onResult, checkCancelOrPause);
            }

            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            if (platforms.indeed || platforms.all) {
              log(`[${currentLoc}] Scraping Indeed...`);
              const remainingLimit = Math.max(5, limit - (userResults.get(userId)?.length || 0));
              await scrapeIndeed(business || keywords, currentLoc, remainingLimit, log, onResult, checkCancelOrPause);
            }

            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            if (platforms.employer_websites || platforms.all) {
              log(`[${currentLoc}] Scraping Employer Websites...`);
              const remainingLimit = Math.max(5, limit - (userResults.get(userId)?.length || 0));
              await scrapeEmployerWebsites(business || keywords, currentLoc, remainingLimit, log, onResult, checkCancelOrPause);
            }

            if ((userResults.get(userId)?.length || 0) >= limit) return;
            await checkCancelOrPause();

            if (platforms.hermes || platforms.all) {
              for (const searchTerm of translatedQueries) {
                if ((userResults.get(userId)?.length || 0) >= limit) break;
                log(`[${currentLoc}] Hermes AI: "${searchTerm}"`);
                const remainingLimit = Math.max(3, limit - (userResults.get(userId)?.length || 0));
                const query = `${searchTerm} in ${currentLoc}`;
                await scrapeWithHermes(query, remainingLimit, log, onResult);
              }
            }

            // --- SMART SOURCE CYCLING FALLBACK ---
            if ((userResults.get(userId)?.length || 0) === initialLeadCount) {
              log(`[Smart Fallback] 0 leads found for ${currentLoc} using primary platforms. Cycling through fallbacks...`);
              
              // Fallback 1: Google Maps
              if (!platforms.google && !platforms.all) {
                log(`[Smart Fallback] Trying Google Maps fallback for ${currentLoc}...`);
                for (const searchTerm of translatedQueries) {
                  if ((userResults.get(userId)?.length || 0) >= limit) break;
                  const query = `${searchTerm} in ${currentLoc}`;
                  await scrapeGoogleMaps(query, Math.max(3, limit - (userResults.get(userId)?.length || 0)), log, onResult, notesContext, deepResearch, checkCancelOrPause);
                }
              }

              // Fallback 2: Yell (UK only)
              if ((userResults.get(userId)?.length || 0) === initialLeadCount && !platforms.yell && !platforms.all && countryCode === 'GB') {
                log(`[Smart Fallback] Trying Yell fallback for ${currentLoc}...`);
                for (const searchTerm of translatedQueries) {
                  if ((userResults.get(userId)?.length || 0) >= limit) break;
                  await scrapeYell(searchTerm, currentLoc, Math.max(3, limit - (userResults.get(userId)?.length || 0)), log, onResult, checkCancelOrPause);
                }
              }

              // Fallback 3: Bing Maps
              if ((userResults.get(userId)?.length || 0) === initialLeadCount && !platforms.bing && !platforms.all) {
                log(`[Smart Fallback] Trying Bing Maps fallback for ${currentLoc}...`);
                for (const searchTerm of translatedQueries) {
                  if ((userResults.get(userId)?.length || 0) >= limit) break;
                  const query = `${searchTerm} in ${currentLoc}`;
                  await scrapeBingMaps(query, Math.max(3, limit - (userResults.get(userId)?.length || 0)), log, onResult, checkCancelOrPause);
                }
              }

              // Fallback 4: Companies House
              if ((userResults.get(userId)?.length || 0) === initialLeadCount && !platforms.companieshouse && !platforms.all) {
                log(`[Smart Fallback] Trying Companies House fallback for ${currentLoc}...`);
                await scrapeCompaniesHouse(`${business || keywords} ${currentLoc}`, Math.max(5, limit - (userResults.get(userId)?.length || 0)), log, onResult, checkCancelOrPause);
              }

              // Fallback 5: Indeed
              if ((userResults.get(userId)?.length || 0) === initialLeadCount && !platforms.indeed && !platforms.all) {
                log(`[Smart Fallback] Trying Indeed fallback for ${currentLoc}...`);
                await scrapeIndeed(business || keywords, currentLoc, Math.max(5, limit - (userResults.get(userId)?.length || 0)), log, onResult, checkCancelOrPause);
              }

              // Fallback 6: Employer Websites
              if ((userResults.get(userId)?.length || 0) === initialLeadCount && !platforms.employer_websites && !platforms.all) {
                log(`[Smart Fallback] Trying Employer Websites fallback for ${currentLoc}...`);
                await scrapeEmployerWebsites(business || keywords, currentLoc, Math.max(5, limit - (userResults.get(userId)?.length || 0)), log, onResult, checkCancelOrPause);
              }
            }

            await markCityScraped(userId, business, countryCode, currentLoc);
          } catch (cityErr) {
            if (cityErr.message === 'CANCELED_BY_USER') {
              isCanceled = true;
            } else {
              log(`Error scraping city ${currentLoc}: ${cityErr.message}`);
            }
          }
        };

        while ((queue.length > 0 || activePromises.size > 0) && !isCanceled) {
          while (queue.length > 0 && activePromises.size < MAX_CONCURRENT && !isCanceled) {
            if ((userResults.get(userId)?.length || 0) >= limit) {
              log(`Reached limit of ${limit} unique leads. Stopping queue.`);
              queue.length = 0;
              break;
            }

            try {
              await checkCancelOrPause();
            } catch (e) {
              if (e.message === 'CANCELED_BY_USER') isCanceled = true;
              break;
            }

            const currentLoc = queue.shift();
            const wrappedPromise = processCity(currentLoc);
            activePromises.add(wrappedPromise);
            wrappedPromise.then(() => activePromises.delete(wrappedPromise));
            
            // Throttle to prevent 429 Too Many Requests from Serper
            await new Promise(r => setTimeout(r, 300));
          }

          if (activePromises.size > 0) {
            await Promise.race(activePromises);
          } else {
            break;
          }
        }

        if (activePromises.size > 0) {
          log(`Waiting for ${activePromises.size} remaining scrape instances to finish...`);
          await Promise.allSettled(activePromises);
        }


        activeScrapes.delete(runId);
        
        if (currentTaskId) {
          const finalStatus = isCanceled ? 'canceled' : (totalLeadsInThisRun > 0 ? 'completed' : 'error');
          
          if (campaignId && totalLeadsInThisRun > 0) {
            const { count } = await client.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId);
            await client.from('campaigns').update({ prospects: count || 0 }).eq('id', campaignId);
          }

          await client.from('tasks').update({ 
            status: finalStatus,
            result: `Found ${totalLeadsInThisRun} leads. Added to campaign: ${campaignName}.`
          }).eq('id', currentTaskId);

          if (!isCanceled) {
            if (totalLeadsInThisRun > 0) {
              log(`[ASSEMBLY LINE] Triggering Validator for ${totalLeadsInThisRun} new leads in ${campaignName}...`);
              await client.from('tasks').insert([{
                assigned_to: 'Validator',
                description: `Validate and clean ${totalLeadsInThisRun} leads for ${business} in campaign ${campaignId} (${campaignName}).`,
                status: 'pending'
              }]);
            } else {
              log(`[ASSEMBLY LINE] 0 leads found. Delegating back to Boss for strategy pivot.`);
              await client.from('tasks').insert([{
                assigned_to: 'Boss',
                description: `### [PIPELINE STALLED] 0 Leads Found for ${business}
The Scraper failed to find any leads in "${location}". 

**Action Required**:
1. Check if the niche "${business}" is too specific.
2. Ask the **Market Researcher** to identify NEW locations or different search keywords.
3. Verify if the campaign "${campaignName}" (ID: ${campaignId}) needs a niche pivot.`,
                status: 'pending'
              }]);
            }
          }
        }

        if (totalLeadsInThisRun > 0) {
          log(`Scraping process fully finished. Found ${totalLeadsInThisRun} leads.`);
          break;
        } else {
          currentRetry++;
          if (currentRetry < MAX_RETRIES) {
             log(`No leads found. Retrying... (${currentRetry}/${MAX_RETRIES})`);
             await new Promise(r => setTimeout(r, 5000));
          } else {
             log(`Max retries reached. No leads found for this search.`);
             break;
          }
        }
          } catch (err) {
            log(`Retry error: ${err.message}`);
          }
          currentRetry++;
        }
      } catch (bgError) {
        activeScrapes.delete(runId);
        if (currentTaskId) {
          await client.from('tasks').update({ status: 'error', result: bgError.message }).eq('id', currentTaskId);
        }
        if (bgError.message === 'CANCELED_BY_USER') {
          log(`Scraping canceled by user.`);
          try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] Scrape Canceled by user.\n`); } catch (e) { }
        } else {
          console.error('Background scrape error:', bgError);
          try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] BG SCRAPE ERROR: ${bgError.stack}\n`); } catch (e) { }
          const logs = userLogs.get(userId) || [];
          logs.push({ timestamp: new Date().toLocaleTimeString(), message: `ERROR: ${bgError.message}` });
          if (logs.length > 50) logs.shift();
          userLogs.set(userId, logs);
        }
      } finally {
        // --- CLEANUP ---
        activeScrapes.delete(runId);
        
        // Clean up memory-intensive stores once finished
        // We give it 1 minute for any final polling to finish before purging
        setTimeout(() => {
          userLogs.delete(userId);
          userResults.delete(userId);
          console.log(`[SYSTEM] Memory cleaned for user ${userId} (Task ${taskId})`);
        }, 60000);

        if (taskId) {
          try {
            await client
              .from('tasks')
              .update({
                completed_at: new Date().toISOString()
              })
              .eq('id', taskId);
          } catch (e) { }
        }
        
        const state = activeScrapes.get(userId);
        if (state && state.runId === runId) {
          client.removeChannel(scrapeChannel);
        }
      }
    }, `scraper-run-${campaignId || 'manual'}`);
    })();



  } catch (error) {
    try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] CATCH BLOCK: ${error.stack}\n`); } catch (e) { }
    console.error('Scraping API Error:', error);

    if (userId) {
      const logs = userLogs.get(userId) || [];
      logs.push({ timestamp: new Date().toLocaleTimeString(), message: `ERROR: ${error.message}` });
      userLogs.set(userId, logs);
      activeScrapes.delete(userId);
    }

    // Only send error response if headers haven't been sent yet
  }
});




app.get('/api/emails', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    let user = null;
    let authError = null;
    let scopedSupabase;
    let isInternalBypass = false;

    if (token === process.env.SUPABASE_ANON_KEY || token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      isInternalBypass = true;
      scopedSupabase = supabase; // Use global client
    } else {
      const authObj = await supabase.auth.getUser(token);
      user = authObj.data?.user;
      authError = authObj.error;

      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // specific client for this user request
      scopedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: authHeader
            }
          }
        }
      );
    }
    
    const refresh = req.query.refresh === 'true';
    const syncNew = req.query.syncNew === 'true';

    const campaignId = req.query.campaignId;

    // Fetch email accounts scoped to this campaign (if campaignId provided) else all user accounts
    let emailAccounts;
    if (campaignId) {
      const { data: campaignAccountLinks, error: linksError } = await scopedSupabase
        .from('campaign_email_accounts')
        .select('email_account_id')
        .eq('campaign_id', campaignId);

      if (linksError) {
        throw new Error(`Failed to fetch campaign accounts: ${linksError.message}`);
      }

      const campaignAccountIds = (campaignAccountLinks || []).map(l => l.email_account_id);

      if (campaignAccountIds.length === 0) {
        return res.json({ success: true, data: [], errors: [] });
      }

      const { data: accounts, error: accountsError } = await scopedSupabase
        .from('email_accounts')
        .select('*')
        .in('id', campaignAccountIds);

      if (accountsError) {
        throw new Error(`Failed to fetch email accounts: ${accountsError.message}`);
      }

      emailAccounts = accounts || [];
    } else {
      let accountsQuery = scopedSupabase.from('email_accounts').select('*');
      if (!isInternalBypass) {
        accountsQuery = accountsQuery.eq('user_id', user.id);
      }
      const { data: accounts, error: accountsError } = await accountsQuery;

      if (accountsError) {
        throw new Error(`Failed to fetch email accounts: ${accountsError.message}`);
      }

      emailAccounts = accounts || [];
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return res.json({ success: true, data: [], errors: [] });
    }

    // ═══ FILTER OUT ACCOUNTS BELONGING TO INACTIVE BUSINESSES ═══
    // This prevents syncing MrMedic accounts (or any disabled business accounts) when the business is inactive.
    if (!campaignId) {
      // Fetch all campaign_email_accounts links for these accounts
      const accountIds = emailAccounts.map(a => a.id);
      const { data: allLinks } = await scopedSupabase
        .from('campaign_email_accounts')
        .select('email_account_id, campaigns(business_id, businesses(status))')
        .in('email_account_id', accountIds);

      if (allLinks && allLinks.length > 0) {
        // Build a set of account IDs that are ONLY linked to inactive businesses
        const inactiveOnlyAccountIds = new Set();
        const activeAccountIds = new Set();
        
        for (const link of allLinks) {
          const bizStatus = link.campaigns?.businesses?.status;
          if (bizStatus === 'active') {
            activeAccountIds.add(link.email_account_id);
          } else {
            inactiveOnlyAccountIds.add(link.email_account_id);
          }
        }
        
        // Remove accounts that are ONLY linked to inactive businesses (not also active ones)
        const skipIds = [...inactiveOnlyAccountIds].filter(id => !activeAccountIds.has(id));
        if (skipIds.length > 0) {
          const skippedEmails = emailAccounts.filter(a => skipIds.includes(a.id)).map(a => a.email);
          console.log(`[SYNC FILTER] Skipping ${skipIds.length} accounts from inactive businesses: ${skippedEmails.join(', ')}`);
          emailAccounts = emailAccounts.filter(a => !skipIds.includes(a.id));
        }
      }
    }

    if (emailAccounts.length === 0) {
      return res.json({ success: true, data: [], errors: [], message: 'All accounts belong to inactive businesses.' });
    }

    // Check if we have emails in DB (scoped to this campaign if applicable)
    let countQuery = scopedSupabase
      .from('inbox_emails')
      .select('*', { count: 'exact', head: true })
      .in('email_account_id', emailAccounts.map(a => a.id));

    if (campaignId) {
      countQuery = countQuery.eq('campaign_id', campaignId);
    }

    const { count, error: countError } = await countQuery;

    const shouldFullSync = refresh || count === 0;
    const shouldIncrementalSync = syncNew && !shouldFullSync;

    const accountErrors = [];

    if (shouldFullSync || shouldIncrementalSync) {
      console.log(`Syncing emails for ${emailAccounts.length} accounts...`);

      // Process accounts serially
      const TIMEOUT_MS = 60000; // Increased timeout for sync
      const MAX_CONCURRENT = 4;

      const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );

      const accountChunks = chunk(emailAccounts, MAX_CONCURRENT);

      for (const batch of accountChunks) {
        await Promise.all(batch.map(async (account) => {
          if (!account.imap_host || !account.encrypted_password) return;

          let client;
          try {
            const fetchPromise = async () => {
              // Decrypt password
              const { data: decryptedPassword, error: decryptError } = await scopedSupabase
                .rpc('decrypt_password', {
                  encrypted_password: account.encrypted_password
                });

              if (decryptError) {
                throw new Error('Decrypt failed');
              }

              client = new ImapFlow({
                host: account.imap_host,
                port: account.imap_port,
                secure: Number(account.imap_port) === 993,
                auth: {
                  user: account.email,
                  pass: decryptedPassword
                },
                greetingTimeout: 15000,
                tls: { rejectUnauthorized: false },
                logger: false
              });

              await client.connect();

              const fetchRecent = async (path, folderType) => {
                try {
                  let lock = await client.getMailboxLock(path);
                  try {
                    const status = await client.status(path, { messages: true, uidNext: true });
                    const total = status.messages;
                    if (total === 0) {
                      lock.release();
                      return;
                    }

                    let range;
                    let fetchOptions = {};
                    if (shouldIncrementalSync) {
                      // Only fetch emails newer than the highest UID we already have
                      const { data: lastEmail } = await scopedSupabase
                        .from('inbox_emails')
                        .select('uid')
                        .eq('email_account_id', account.id)
                        .eq('folder', folderType)
                        .order('uid', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                      const lastUid = lastEmail?.uid || 0;
                      if (lastUid > 0 && status.uidNext && lastUid >= status.uidNext - 1) {
                        // No new emails since last sync
                        lock.release();
                        return;
                      }
                      range = `${lastUid + 1}:*`;
                      fetchOptions = { uid: true };
                      console.log(`[${account.email}] Incremental sync ${folderType}: fetching UIDs from ${lastUid + 1}`);
                    } else {
                      // Full sync: fetch last 500
                      const fetchCount = 500;
                      const start = Math.max(1, total - (fetchCount - 1));
                      range = `${start}:*`;
                    }

                    for await (const message of client.fetch(range, { envelope: true, source: true, uid: true, flags: true }, fetchOptions)) {
                      const parsed = await simpleParser(message.source);
                      const isRead = message.flags && message.flags.has ? message.flags.has('\\Seen') : false;

                      const senderText = parsed.from?.text || '';

                      const subjectText = (parsed.subject || '').toLowerCase();
                      const bodyText = (parsed.text || '').toLowerCase();
                      const isAutoReply =
                        (parsed.headers && parsed.headers.get('auto-submitted') && parsed.headers.get('auto-submitted') !== 'no') ||
                        (parsed.headers && parsed.headers.get('x-autogenerated') === 'reply') ||
                        (parsed.headers && parsed.headers.get('precedence') && ['bulk', 'junk', 'list'].includes(parsed.headers.get('precedence'))) ||
                        /^(auto:|automatic reply:|autoreply:|out of office|ooo:|vacation|undeliverable)/i.test(subjectText) ||
                        bodyText.includes('we are currently in a busy time') ||
                        bodyText.includes('reply as soon as possible') ||
                        bodyText.includes('this is an automated response') ||
                        bodyText.includes('send all invoices to') ||
                        bodyText.includes('do not reply') ||
                        bodyText.includes('this email box is not monitored') ||
                        bodyText.includes('this mailbox is not monitored') ||
                        bodyText.includes('this inbox is not monitored') ||
                        bodyText.includes('please do not reply to this email') ||
                        (bodyText.includes('unsubscribe') && bodyText.includes('subscriber preferences'));

                      const senderAddr = (parsed.from?.value?.[0]?.address || '').toLowerCase();
                      const isNoReplySender =
                        senderAddr.includes('noreply') ||
                        senderAddr.includes('no-reply') ||
                        senderAddr.includes('donotreply') ||
                        senderAddr.includes('do-not-reply') ||
                        senderAddr.includes('mailer-daemon') ||
                        senderAddr.includes('postmaster@');

                      let campaignIdMatch = parsed.headers && parsed.headers.get('x-campaign-id') ? parsed.headers.get('x-campaign-id') : null;
                      let leadIdMatch = null;
                      let businessIdMatch = null;

                      // Try to match the sender's email to a campaign lead
                      if (folderType === 'inbox') {
                        const senderEmail = parsed.from?.value?.[0]?.address || (parsed.from?.text || '').match(/<([^>]+)>/)?.[1] || parsed.from?.text;
                        if (senderEmail) {
                          const cleanSenderEmail = senderEmail.trim().toLowerCase();
                          try {
                            const { data: leadMatch } = await scopedSupabase
                              .from('leads')
                              .select('id, status, campaign_leads(campaign_id)')
                              .ilike('email', cleanSenderEmail)
                              .limit(1)
                              .maybeSingle();

                            if (leadMatch) {
                              leadIdMatch = leadMatch.id;
                              if (!campaignIdMatch && leadMatch.campaign_leads?.[0]?.campaign_id) {
                                campaignIdMatch = leadMatch.campaign_leads[0].campaign_id;
                              }
                            }
                          } catch (e) {
                            console.warn("Could not match lead email to campaign:", e);
                          }
                        }
                      }

                      if (campaignIdMatch) {
                        try {
                          const { data: campData } = await scopedSupabase.from('campaigns').select('business_id').eq('id', campaignIdMatch).maybeSingle();
                          if (campData) businessIdMatch = campData.business_id;
                        } catch (e) {}
                      }

                      const isOptOut =
                        bodyText.includes('unsubscribe') ||
                        bodyText.includes('take me off') ||
                        bodyText.includes('remove me') ||
                        bodyText.includes('stop sending') ||
                        bodyText.includes('do not contact') ||
                        bodyText.includes('opt out') ||
                        bodyText.includes('opt-out') ||
                        bodyText.includes('no thank you') ||
                        bodyText.includes('no thanks') ||
                        bodyText.includes('not interested');

                      const isBounce = senderText.toLowerCase().includes('mailer-daemon') || isNoReplySender || /undeliverable/i.test(subjectText);

                      if (isBounce) {
                        const originalRecipientMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                        const bouncedEmail = originalRecipientMatch ? originalRecipientMatch.find(e => e.toLowerCase() !== account.email.toLowerCase())?.toLowerCase() : null;
                        
                        if (bouncedEmail) {
                          try {
                            const { data: bLead } = await scopedSupabase.from('leads').select('id, campaign_leads(campaign_id)').ilike('email', bouncedEmail).limit(1).maybeSingle();
                            if (bLead) {
                                leadIdMatch = bLead.id;
                                if (!campaignIdMatch && bLead.campaign_leads?.[0]?.campaign_id) {
                                    campaignIdMatch = bLead.campaign_leads[0].campaign_id;
                                }
                            }
                          } catch (e) {}

                          await scopedSupabase.from('leads').update({ status: 'bounced' }).ilike('email', bouncedEmail);
                          await scopedSupabase.from('global_blacklist').insert({ email: bouncedEmail, reason: 'bounced' });
                        } else if (leadIdMatch) {
                          await scopedSupabase.from('leads').update({ status: 'bounced' }).eq('id', leadIdMatch);
                        }
                      }

                      if (isOptOut && folderType === 'inbox') {
                        const senderEmail = parsed.from?.value?.[0]?.address || (parsed.from?.text || '').match(/<([^>]+)>/)?.[1] || parsed.from?.text;
                        if (senderEmail && businessIdMatch) {
                           await scopedSupabase.from('business_opt_outs').insert({ business_id: businessIdMatch, email: senderEmail.trim().toLowerCase() });
                        }
                        if (leadIdMatch) {
                           await scopedSupabase.from('leads').update({ status: 'closed' }).eq('id', leadIdMatch);
                        }
                      } else if (isAutoReply && folderType === 'inbox' && leadIdMatch) {
                        await scopedSupabase.from('leads').update({ status: 'closed' }).eq('id', leadIdMatch);
                      } else if (folderType === 'inbox' && leadIdMatch) {
                        // Normal reply
                        const { data: currentLead } = await scopedSupabase.from('leads').select('status').eq('id', leadIdMatch).maybeSingle();
                        if (currentLead && currentLead.status !== 'closed' && currentLead.status !== 'interested' && currentLead.status !== 'bounced') {
                          await scopedSupabase.from('leads').update({ status: 'interested' }).eq('id', leadIdMatch);
                        }
                      }

                      const emailData = {
                        email_account_id: account.id,
                        uid: message.uid,
                        folder: folderType,
                        from: parsed.from?.text || 'Unknown',
                        to: parsed.to?.text || 'Unknown',
                        subject: parsed.subject || '(No Subject)',
                        received_at: parsed.date || new Date(),
                        snippet: parsed.text ? parsed.text.substring(0, 100) : '',
                        body_text: parsed.text,
                        body_html: parsed.html || parsed.textAsHtml, // Fallback if needed
                        is_read: isRead,
                        campaign_id: campaignIdMatch
                      };

                      // Upsert to DB
                      await scopedSupabase
                        .from('inbox_emails')
                        .upsert(emailData, {
                          onConflict: 'email_account_id,folder,uid'
                        });
                    }
                  } finally {
                    lock.release();
                  }
                } catch (err) {
                  console.warn(`[${account.email}] Could not fetch ${path}: ${err.message}`);
                }
              };

              await fetchRecent('INBOX', 'inbox');

              // Try to guess Sent folder
              const listed = await client.list();
              const sentFolder = listed.find(f =>
                f.specialUse === '\\Sent' ||
                f.name === 'Sent' ||
                f.name === 'Sent Items' ||
                f.path === '[Gmail]/Sent Mail' ||
                f.path === 'INBOX.Sent'
              );

              if (sentFolder) {
                await fetchRecent(sentFolder.path, 'sent');
              }

              await client.logout();
            };

            await Promise.race([
              fetchPromise(),
              new Promise((_, reject) =>
                setTimeout(() => {
                  if (client) {
                    client.close();
                  }
                  reject(new Error('Connection timed out'));
                }, TIMEOUT_MS)
              )
            ]);

          } catch (err) {
            console.error(`Error processing account ${account.email}:`, err.message);
            accountErrors.push({ email: account.email, error: err.message });
          }
        }));
      }
    }

    // Return emails from DB — filtered by campaign_id to prevent cross-campaign leakage
    let query = scopedSupabase
      .from('inbox_emails')
      .select('*')
      .in('email_account_id', emailAccounts.map(a => a.id));

    // Always filter by campaign_id when provided — email accounts can be shared across campaigns
    if (campaignId && campaignId !== 'undefined') {
      query = query.eq('campaign_id', campaignId);
    }

    if (req.query.emailAccountId && req.query.emailAccountId !== 'undefined') {
      query = query.eq('email_account_id', req.query.emailAccountId);
    }

    if (req.query.folder && req.query.folder !== 'undefined') {
      query = query.eq('folder', req.query.folder);
    }

    const { data: allEmails, error: fetchError } = await query
      .order('received_at', { ascending: false })
      .limit(1000); // Limit return size for performance

    if (fetchError) {
      throw new Error(`Failed to fetch emails from DB: ${fetchError.message}`);
    }

    // Transform for frontend
    const transformedEmails = allEmails.map(email => {
      // Find account email
      const account = emailAccounts.find(a => a.id === email.email_account_id);
      return {
        id: email.id,
        uid: email.uid,
        accountId: email.email_account_id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        date: email.received_at,
        snippet: email.body_text ? email.body_text.substring(0, 100) : '',
        folder: email.folder,
        isRead: email.is_read,
        html: email.body_html,
        text: email.body_text,
        sequenceStep: email.sequence_step,
        accountEmail: account ? account.email : 'Unknown'
      };
    });

    res.json({ success: true, data: transformedEmails, errors: accountErrors });

  } catch (error) {
    console.error('Email fetch error:', error);
    try {
      fs.appendFileSync('server.log', `[${new Date().toISOString()}] /api/emails Error: ${error.stack || error.message}\n`);
    } catch (e) { console.error('Failed to write to log', e); }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch emails'
    });
  }
});

app.post('/api/emails/action', async (req, res) => {
  try {
    const { emailAccountId, uids, action, folder } = req.body;

    if (!emailAccountId || !uids || !Array.isArray(uids) || uids.length === 0 || !action) {
      throw new Error('Missing required fields');
    }

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Missing authorization header');
    const token = authHeader.replace('Bearer ', '');

    const scopedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await scopedSupabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    // Get Account
    const { data: account, error: accountError } = await scopedSupabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) throw new Error('Email account not found');

    // Decrypt Password
    const { data: decryptedPassword, error: decryptError } = await scopedSupabase
      .rpc('decrypt_password', { encrypted_password: account.encrypted_password });

    if (decryptError) throw new Error('Decrypt failed');

    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: Number(account.imap_port) === 993,
      auth: { user: account.email, pass: decryptedPassword },
      greetingTimeout: 15000,
      tls: { rejectUnauthorized: false },
      logger: false
    });

    await client.connect();

    try {
      let lock = await client.getMailboxLock('INBOX');
      try {
        let actualPath = 'INBOX';

        if (folder === 'sent') {
          const listed = await client.list();
          const sentF = listed.find(f => f.specialUse === '\\Sent' || f.name === 'Sent' || f.path === '[Gmail]/Sent Mail');
          if (sentF) actualPath = sentF.path;
        }

        if (actualPath !== 'INBOX') {
          lock.release();
          lock = await client.getMailboxLock(actualPath);
        }

        if (action === 'delete') {
          // Find emails first to close the associated leads
          try {
            const { data: emailsToDelete } = await scopedSupabase
              .from('inbox_emails')
              .select('from, to, campaign_id')
              .eq('email_account_id', emailAccountId)
              .in('uid', uids)
              .eq('folder', folder);

            if (emailsToDelete && emailsToDelete.length > 0) {
              for (const e of emailsToDelete) {
                const leadEmailRaw = folder === 'inbox' ? e.from : e.to;
                const leadEmailMatch = leadEmailRaw.match(/<([^>]+)>/);
                const leadEmail = leadEmailMatch ? leadEmailMatch[1] : leadEmailRaw;

                if (e.campaign_id && leadEmail) {
                  const { data: leadMatch } = await scopedSupabase
                    .from('leads')
                    .select('id, campaign_leads!inner(campaign_id)')
                    .eq('campaign_leads.campaign_id', e.campaign_id)
                    .ilike('email', leadEmail.trim().toLowerCase())
                    .limit(1)
                    .maybeSingle();

                  if (leadMatch) {
                    await scopedSupabase.from('leads').update({ status: 'closed' }).eq('id', leadMatch.id);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Failed to close leads during delete:', e.message);
          }

          // IMAP Delete
          try {
            const listed = await client.list();
            const trashResults = listed.find(f => f.specialUse === '\\Trash' || f.name.toLowerCase() === 'trash' || f.name.toLowerCase() === 'bin' || f.name.toLowerCase() === 'deleted items' || f.path.toLowerCase() === '[gmail]/trash');

            if (trashResults) {
              await client.messageMove(uids, trashResults.path, { uid: true });
            } else {
              await client.messageDelete(uids, { uid: true });
            }
          } catch (imapErr) {
            console.warn('IMAP Delete failed, proceeding with DB delete:', imapErr.message);
          }

          // DB Delete
          const { error: dbDeleteErr } = await scopedSupabase
            .from('inbox_emails')
            .delete()
            .eq('email_account_id', emailAccountId)
            .in('uid', uids)
            .eq('folder', folder);

          if (dbDeleteErr) throw dbDeleteErr;

        } else if (action === 'archive') {
          // IMAP Archive
          const listed = await client.list();
          const archiveFolder = listed.find(f =>
            f.specialUse === '\\Archive' ||
            f.name === 'Archive' ||
            f.path === '[Gmail]/All Mail'
          );

          if (archiveFolder) {
            await client.messageMove(uids, archiveFolder.path, { uid: true });

            // DB Archive
            await scopedSupabase
              .from('inbox_emails')
              .update({ folder: 'archive' })
              .eq('email_account_id', emailAccountId)
              .in('uid', uids)
              .eq('folder', folder);
          } else {
            throw new Error('Archive folder not found');
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Action error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Action failed'
    });
  }
});

app.post('/api/validate-email', async (req, res) => {
  try {
    const { email, leadId } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Optional: caching/persistence logic if leadId and auth provided
    const authHeader = req.headers.authorization;
    let scopedSupabase = null;

    if (authHeader && leadId) {
      scopedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: authHeader } } }
      );

      // Check if already valid
      const { data: lead, error: fetchError } = await scopedSupabase
        .from('leads')
        .select('validation_status, validation_details')
        .eq('id', leadId)
        .single();

      if (!fetchError && lead && lead.validation_status === 'valid') {
        console.log(`[Validation] Returning cached valid status for lead ${leadId}`);
        return res.json({
          success: true,
          isValid: true,
          details: lead.validation_details || 'Valid (Cached)',
          cached: true
        });
      }
    }

    // Run validation
    const result = await validateEmail(email);

    // Save result if we can
    if (scopedSupabase && leadId) {
      const status = result.isValid ? (result.warning ? 'warning' : 'valid') : 'invalid';
      const details = result.isValid ? (result.warning ? result.details : 'Valid') : (result.reason || 'Invalid');

      await scopedSupabase
        .from('leads')
        .update({
          validation_status: status,
          validation_details: details
        })
        .eq('id', leadId);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

app.post('/api/send-email', async (req, res) => {
  try {
    const { from, to, subject, text, smtp, emailAccountId } = req.body;

    // Get email account warmup settings
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create a scoped Supabase client for this request to ensure RLS policies work
    const scopedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await scopedSupabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('User not authenticated');
    }
    console.log('User found:', user.id);
    console.log('Looking for email account:', emailAccountId);

    const { data: emailAccount, error: accountError } = await scopedSupabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !emailAccount) {
      console.error('Account search error:', accountError);
      throw new Error('Email account not found or access denied');
    }
    console.log('Email account found:', emailAccount.id);

    // Safety checks: Block emails for inactive businesses
    const senderEmail = emailAccount.email ? emailAccount.email.toLowerCase() : '';

    const campaignId = req.headers['x-campaign-id'] || req.body.campaignId;

    if (campaignId) {
      const { data: campaign } = await scopedSupabase
        .from('campaigns')
        .select('*, businesses(*)')
        .eq('id', campaignId)
        .maybeSingle();

      if (campaign) {
        if (campaign.businesses?.status !== 'active') {
          return res.status(400).json({ success: false, error: `The business "${campaign.businesses?.name || 'Unknown'}" is currently inactive/disabled.` });
        }
      }
    } else {
      // If no campaignId provided, check if the email account belongs to inactive businesses
      const { data: campaignLinks } = await scopedSupabase
        .from('campaign_email_accounts')
        .select('campaign_id, campaigns(id, name, business_id, businesses(id, name, status))')
        .eq('email_account_id', emailAccount.id);

      if (campaignLinks && campaignLinks.length > 0) {
        const inactiveCampaigns = campaignLinks.filter(link => link.campaigns?.businesses?.status !== 'active');
        if (inactiveCampaigns.length === campaignLinks.length) {
          return res.status(400).json({ success: false, error: 'The business associated with this email account is currently inactive/disabled.' });
        }
      }
    }

    let emailsSentToday = 0;
    const today = new Date().toISOString().split('T')[0];

    // Check warmup settings if enabled - ONLY IF this is a warmup email or we are enforcing limits
    const isWarmup = req.body.isWarmup === true || (emailAccount.warmup_status === 'enabled' && subject.includes(emailAccount.warmup_filter_tag || 'WARMUP'));
    
    if (isWarmup && emailAccount.warmup_status === 'enabled') {
      // Get today's warmup progress
      const { data: warmupProgress, error: progressError } = await scopedSupabase
        .from('email_warmup_progress')
        .select('emails_sent')
        .eq('email_account_id', emailAccountId)
        .eq('date', today)
        .single();

      if (progressError && progressError.code !== 'PGRST116') {
        throw new Error('Failed to check warmup progress');
      }

      emailsSentToday = warmupProgress?.emails_sent || 0;

      // Check daily limit with ramp-up logic
      let effectiveLimit = emailAccount.warmup_daily_limit;

      if (emailAccount.warmup_start_date && emailAccount.warmup_increase_per_day > 0) {
        const startDate = new Date(emailAccount.warmup_start_date);
        const now = new Date();
        const diffTime = now.getTime() - startDate.getTime(); // Use getTime() explicitly
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        // Calculate limit: (Day 1 * increase)
        // Day 0 (start date) = increase
        const calculatedLimit = (diffDays + 1) * emailAccount.warmup_increase_per_day;

        effectiveLimit = Math.min(emailAccount.warmup_daily_limit, calculatedLimit);
        console.log(`[Warmup] Account ${emailAccount.email}: Day ${diffDays + 1}, effective limit ${effectiveLimit}/${emailAccount.warmup_daily_limit}`);
      }

      if (emailsSentToday >= effectiveLimit) {
        throw new Error(`Daily warmup limit of ${effectiveLimit} emails reached`);
      }

      // Check if subject contains filter tag if specified
      if (emailAccount.warmup_filter_tag && !subject.includes(emailAccount.warmup_filter_tag)) {
        throw new Error(`Email subject must contain warmup filter tag: ${emailAccount.warmup_filter_tag}`);
      }
    }

    // Check if we have an encrypted password
    if (!smtp.auth.pass) {
      throw new Error('Email account credentials key is missing. Please remove and re-add this email account to fix security settings.');
    }

    // Decrypt password
    const { data: decryptedPassword, error: decryptError } = await scopedSupabase
      .rpc('decrypt_password', {
        encrypted_password: smtp.auth.pass
      });

    if (decryptError) {
      throw new Error('Failed to decrypt password');
    }

    // Extract domain from sender email for rate limiting
    const senderIdentifier = emailAccount.email.toLowerCase();
    if (senderIdentifier) {
      const { data: canSend, error: limitError } = await scopedSupabase.rpc('increment_domain_email_count', {
        p_domain: senderIdentifier,
        p_max_limit: 30 // Set to 30 emails per hour per domain
      });
      
      if (limitError) {
        console.error('Domain limit check error:', limitError);
      } else if (!canSend) {
        throw new Error(`Domain ${senderDomain} has exceeded the max emails per hour (30) allowed. Message will be reattempted later.`);
      }
    }

    // Create transporter using SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.auth.user,
        pass: decryptedPassword
      }
    });

    // Format Sender Name
    let finalFrom = from;
    if (emailAccount.name && (from === emailAccount.email || from.includes(emailAccount.email))) {
      // Only override if it looks like just an email or matches the account email
      // But nodemailer handles "Name <email>" fine. 
      // If 'from' passed is just 'email@domain.com', change it.
      if (!from.includes('<')) {
        finalFrom = `"${emailAccount.name}" <${emailAccount.email}>`;
      }
    }

    // Append Signature
    let finalText = text;
    if (emailAccount.signature) {
      finalText = `${text}\n\n--\n${emailAccount.signature}`;
    }

    // Send email
    await transporter.sendMail({
      from: finalFrom,
      to,
      subject,
      text: finalText
    });

    // Record in inbox_emails so it appears in the UI immediately
    try {
      await scopedSupabase.from('inbox_emails').insert({
        email_account_id: emailAccountId,
        folder: 'sent',
        uid: Math.floor(Math.random() * 1000000000),
        from: finalFrom,
        to: to,
        subject: subject,
        body_text: text,
        received_at: new Date().toISOString(),
        is_read: true,
        campaign_id: req.headers['x-campaign-id'] || null,
        sequence_step: 'Direct'
      });
    } catch (dbErr) {
      console.warn('Failed to record sent email in DB:', dbErr.message);
    }

    // Update warmup progress ONLY if this was explicitly a warmup email and status is enabled
    if (isWarmup && emailAccount.warmup_status === 'enabled') {
      const today = new Date().toISOString().split('T')[0];

      // Upsert warmup progress
      const { error: upsertError } = await supabase
        .from('email_warmup_progress')
        .upsert({
          email_account_id: emailAccountId,
          date: today,
          emails_sent: emailsSentToday + 1
        }, {
          onConflict: 'email_account_id,date'
        });

      if (!upsertError) {
        // Also update the last_warmup_sent_at timestamp on the account
        await supabase
          .from('email_accounts')
          .update({ last_warmup_sent_at: new Date().toISOString() })
          .eq('id', emailAccountId);
      }

      if (upsertError) {
        throw new Error('Failed to update warmup progress');
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    });
  }
});

app.get('/api/local-lists', async (req, res) => {
  try {
    const savedListsDir = path.resolve(__dirname, '../../../backend/saved_lists');
    if (!fs.existsSync(savedListsDir)) {
      return res.json({ success: true, lists: [] });
    }

    const getAllFiles = (dirPath, arrayOfFiles) => {
      const files = fs.readdirSync(dirPath);
      arrayOfFiles = arrayOfFiles || [];

      files.forEach((file) => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
          arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else if (file.endsWith('.json')) {
          arrayOfFiles.push({
            filename: path.relative(savedListsDir, path.join(dirPath, file)).replace(/\\/g, '/'),
            fullPath: path.join(dirPath, file)
          });
        }
      });

      return arrayOfFiles;
    };

    const files = getAllFiles(savedListsDir, []);
    const lists = files.map(fileInfo => {
      const stats = fs.statSync(fileInfo.fullPath);
      // Extract niche from relative path
      const parts = fileInfo.filename.split('/');
      const niche = parts.length > 1 ? parts[0].replace(/_/g, ' ') : 'General';
      const displayName = parts[parts.length - 1].replace(/_[0-9]+\.json$/, '').replace(/_/g, ' ');
      
      return {
        filename: fileInfo.filename,
        name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        niche: niche.charAt(0).toUpperCase() + niche.slice(1),
        size: stats.size,
        createdAt: stats.birthtime,
      };
    });
    res.json({ success: true, lists });
  } catch (error) {
    console.error('Error reading local lists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/local-lists/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const savedListsDir = path.resolve(__dirname, '../../../backend/saved_lists');
    const filePath = path.join(savedListsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const leads = JSON.parse(content);
    res.json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import-local-list', async (req, res) => {
  try {
    const { filename, listName } = req.body;
    const savedListsDir = path.resolve(__dirname, '../../../backend/saved_lists');
    const filePath = path.join(savedListsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const leads = JSON.parse(content);

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const client = supabase || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
    const { data: { user } } = await client.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // This part matches the logic in lists.ts createList but as a server-side operation
    const { data: list, error: listError } = await client
      .from('saved_lists')
      .insert({
        user_id: user.id,
        name: listName || filename.replace(/_[0-9]+\.json$/, '').replace(/_/g, ' '),
      })
      .select()
      .single();

    if (listError) throw listError;

    // Batch insert leads and associations
    const leadsToInsert = leads.map(l => ({
      user_id: user.id,
      email: l.email,
      name: l.name,
      company: l.company,
      title: l.title,
      website: l.website,
      industry: l.industry,
      location: l.location,
      summary: l.summary,
      personalized_email: l.personalized_email
    }));

    const { error: leadsError } = await client
      .from('leads')
      .upsert(leadsToInsert, { onConflict: 'user_id,website,email', ignoreDuplicates: true });
    
    if (leadsError) throw leadsError;

    // Re-fetch to get IDs
    const { data: matchedLeads } = await client
      .from('leads')
      .select('id')
      .eq('user_id', user.id)
      .in('email', leads.map(l => l.email));

    if (matchedLeads) {
      const associations = matchedLeads.map(l => ({
        list_id: list.id,
        lead_id: l.id
      }));
      await client.from('list_leads').insert(associations);
    }

    res.json({ success: true, listId: list.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;

// Start background services if enabled
if (process.env.ENABLE_CRONS !== 'false') {
  console.log('[SYSTEM] Background services enabled.');
  startCompaniesHouseCron();
  startAutoAssignCron();
  startScraperSchedulerCron();
  startEmailerCron();
  startBounceProcessorCron();
  startSyncEmailsCron();
  startResearchCron(); // Research cron always runs - processes deep research queue
  console.log('[SYSTEM] Research cron started - processing deep research queue...');
  
  // Start the background old leads migrator (migrates 3 leads every 2 minutes when scraper is idle)
  initOldLeadsMigrator(activeScrapes);

  // Background routine to check for and automatically generate sequence templates for campaigns missing them
  const autofillMissingCampaignSequences = async () => {
    try {
      const client = supabase;
      if (!client) return;

      console.log('[Sequence Autofill] Checking for campaigns missing sequence templates...');
      
      const { data: campaigns, error: fetchErr } = await client
        .from('campaigns')
        .select('id, name');

      if (fetchErr) {
        console.error('[Sequence Autofill] Error fetching campaigns:', fetchErr.message);
        return;
      }

      if (!campaigns || campaigns.length === 0) return;

      for (const campaign of campaigns) {
        const { count, error: countErr } = await client
          .from('templates')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id);

        if (countErr) {
          console.error(`[Sequence Autofill] Error checking templates for campaign ${campaign.name}:`, countErr.message);
          continue;
        }

        if (count === 0) {
          console.log(`[Sequence Autofill] Campaign "${campaign.name}" (${campaign.id}) has 0 sequences. Generating templates now...`);
          const success = await generateAndSaveSequencesForCampaign(campaign.id, false);
          if (success) {
            console.log(`[Sequence Autofill] ✅ Generated sequence templates for campaign "${campaign.name}"`);
          } else {
            console.error(`[Sequence Autofill] ❌ Failed to generate sequence templates for campaign "${campaign.name}"`);
          }
        }
      }
    } catch (err) {
      console.error('[Sequence Autofill] Unexpected error in checker:', err.message);
    }
  };

  // Run on startup after 5 seconds, and then every 2 minutes
  setTimeout(autofillMissingCampaignSequences, 5000);
  setInterval(autofillMissingCampaignSequences, 2 * 60 * 1000);
} else {
  console.log('[SYSTEM] Background services (crons) are DISABLED via ENABLE_CRONS=false.');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Log startup config
  if (!process.env.SUPABASE_URL) console.warn('WARNING: Missing SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY) console.warn('WARNING: Missing SUPABASE_ANON_KEY');

  // Automated 24-hour Log Pruning Routine (Keep DB and disk clean)
  const pruneOldLogs = async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const client = supabase || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
      if (client) {
        await client.from('scraper_logs').delete().lt('timestamp', sevenDaysAgo);
      }
      // Truncate local logs if larger than 5MB
      ['scraper_debug.log', 'scraper_endpoint.log'].forEach(file => {
        if (fs.existsSync(file) && fs.statSync(file).size > 5 * 1024 * 1024) {
          fs.writeFileSync(file, `[${new Date().toISOString()}] [Auto Log Rotation]\n`);
        }
      });
    } catch (e) {
      console.error('[Log Prune] Error during automated log cleanup:', e.message);
    }
  };

  pruneOldLogs();
  setInterval(pruneOldLogs, 24 * 60 * 60 * 1000); // Run daily
});

export default app;
