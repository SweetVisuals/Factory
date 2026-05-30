import 'dotenv/config'; // triggerrestart

import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { validateEmail } from './email-validation.mjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL ERROR: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.');
}

// Create client only if vars exist to prevent crash, otherwise null
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const app = express();
app.use(express.json());

// Add a root route for health check
app.get('/', (req, res) => {
  res.send('ColdSpark Backend API is running. Time: ' + new Date().toISOString());
});
app.get('/api', (req, res) => {
  res.send('API Root Accessible');
});
app.use(cors({
  origin: true, // Reflect request origin to allow all
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-campaign-id']
}));

// Handle preflight requests explicitly
app.options('*', cors());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-d703ac9c0fe74d05b1693c50a81ea9bc';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

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
Use [[notes]] as the anchor for personalisation. Do NOT find specific facts.
Do NOT mention the lead's role or job title anywhere in the emails.
${isSingle ? '' : 'Each email MUST be completely different in topic and approach — no repetition across steps.'}

SUBJECT LINE REQUIREMENT: Each subject line must be sharply niche-specific to "${niche}" and genuinely intriguing to a decision-maker in that space. Think carefully about the real daily challenges, ambitions, and pressures of someone running a business in the "${niche}" industry, and write subjects that speak directly to those. Be bold, be specific, be original. Do NOT use generic phrases.`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 1.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt + contextPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    console.log('DeepSeek Response:', data);

    if (data.error) {
      throw new Error(data.error.message || 'DeepSeek API Error');
    }

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
        const systemPrompt = `You are rewriting a cold email template to make it feel personal and human for a specific lead.

Your personality: Friendly, genuinely curious, slightly witty. You sound like a real person who actually looked into their business — not a mail-merge robot.

Instructions:
1. Replace [[notes]] with a natural, specific observation drawn from the provided notes. Make it sound like YOU noticed it, not like you're quoting a database.
2. Replace {{first_name}} with "${leadFirstName}". Replace {{company}} with "${lead.company || ''}".
3. GREETING: Use "Hi ${leadFirstName}," — NEVER use the lead's full name (first + last). Never use their last name.
4. NEVER mention the lead's job title, role, or position anywhere in the email. Remove any reference to their role if it exists in the template.
5. Tone: Warm, concise, genuinely helpful. Like messaging someone you want to work with, not sell to.
6. Keep it SHORT. Under 80 words for the body. Every sentence should earn its place.
7. DO NOT include any sign-off (e.g. "Cheers", "Best"). It is added automatically by the system.
8. Output: JSON with "subject" and "content" keys only.

Context:
Sender Company: ${company || 'Our Company'}
Lead Company: ${lead.company || 'Unknown'}
Lead First Name: ${leadFirstName}
Research Notes: "${lead.summary || 'General interest'}"

Template Subject: ${templateSubject}
Template Body: ${templateContent}`;

        const userPrompt = `Personalise this email for ${leadFirstName} at ${lead.company || 'their company'}.
Use these notes for context: "${lead.summary || 'General outreach'}"

Rules:
- Do NOT copy-paste the notes. Rephrase naturally.
- Do NOT mention their job title or role.
- Do NOT use their full name — first name only.
- Keep the email short, friendly, and genuine.
- MANDATORY: End the email with exactly these placeholders:
  {{ender}}
  {{sender_first_name}}
  {{sender_phone}}
  {{sender_email}}
- Return ONLY a JSON object with 'subject' and 'content' keys.`;

        try {
          const aiResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              response_format: { type: 'json_object' }
            })
          });

          const data = await aiResponse.json();
          if (data.error) throw new Error(data.error.message);

          const personalized = JSON.parse(data.choices[0].message.content);

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
app.post('/api/verify-smtp', async (req, res) => {
  try {
    const { host, port, email, password } = req.body;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
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
      port,
      secure: port === 993,
      auth: {
        user: email,
        pass: password,
      },
    });

    await client.connect();
    await client.logout();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'IMAP verification failed'
    });
  }
});

import { scrapeGoogleMaps, scrapeLinkedIn, scrapeGeneralSearch, performDeepResearch } from './scraper.mjs';

// User-specific stores for live updates
const userLogs = new Map();
const userResults = new Map();
const activeScrapes = new Map();

app.get('/api/scraper-active', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json({ active: false });

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.json({ active: false });

    res.json({ active: activeScrapes.get(user.id) || false });
  } catch (e) {
    res.json({ active: false });
  }
});

app.get('/api/scraper-logs', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json([]);

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.json([]);

    res.json(userLogs.get(user.id) || []);
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
    const { company, website, notesContext } = req.body;
    if (!company) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    const report = await performDeepResearch(company, website, notesContext);
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Deep Research API Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Deep Research failed'
    });
  }
});

app.post('/api/scrape-leads', async (req, res) => {
  let userId = null;
  try {
    try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] Scrape API Called. Body: ${JSON.stringify(req.body)}\n`); } catch (e) { }

    const { platforms = {}, business, location, keywords, notesContext, limit = 20 } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] Failed: Missing authHeader\n`); } catch (e) { }
      return res.status(401).json({ success: false, error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    userId = user.id;

    // Initialize user-specific stores
    userLogs.set(userId, []);
    userResults.set(userId, []);
    activeScrapes.set(userId, true);

    // Respond immediately - scrape runs in background, frontend polls for updates
    res.json({ success: true, message: 'Scrape started' });

    const log = (message) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${userId}] ${message}`);
      const logs = userLogs.get(userId) || [];
      logs.push({ timestamp, message });
      if (logs.length > 200) logs.shift();
      userLogs.set(userId, logs);
    };

    const onResult = async (lead) => {
      const results = userResults.get(userId) || [];
      const exists = results.some(r => (r.website && r.website === lead.website) || (r.email && r.email === lead.email));

      if (!exists) {
        results.push(lead);
        userResults.set(userId, results);
        console.log(`[Main Server] Added lead for ${userId}: ${lead.company}`);

        // Save to Supabase
        const scopedSupabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: authHeader } } }
        );

        const leadData = {
          user_id: userId,
          company: lead.company || '',
          email: lead.email || '',
          website: lead.website || '',
          location: lead.location || '',
          phone: lead.phone || '',
          summary: lead.summary || '',
          source: lead.source || 'scraped',
          status: 'new',
          facebook: lead.facebook || '',
          twitter: lead.twitter || '',
          instagram: lead.instagram || '',
          role: lead.role || '',
          name: lead.name || ''
        };

        const { error } = await scopedSupabase
          .from('leads')
          .upsert(leadData, {
            onConflict: 'user_id,website,email',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('[Main Server] Error saving lead to DB:', error.message);
        }
      }
    };

    // Run scraping in background (not awaited by the HTTP response)
    (async () => {
      try {
        log(`Starting scrape for ${business} in ${location}...`);
        if (notesContext) log(`Custom Notes Focus: ${notesContext}`);

        let totalResults = [];

        if (platforms.google || platforms.all) {
          const query = `${business || keywords} in ${location}`;
          const googleResults = await scrapeGoogleMaps(query, limit, log, onResult, notesContext);
          totalResults = [...totalResults, ...googleResults];
        }

        if (platforms.linkedin || platforms.all) {
          const jobRole = req.body.jobRole || '';
          const businessPart = business ? business : "";
          const rolePart = jobRole ? jobRole : "";
          const locationPart = location ? location : "";

          const linkedInQuery = `site:linkedin.com/in/ ${rolePart} ${businessPart} ${locationPart} ${keywords || ""}`.trim();
          const linkedInResults = await scrapeLinkedIn(linkedInQuery, limit, log, onResult, notesContext);
          totalResults = [...totalResults, ...linkedInResults];
        }

        if (platforms.general || platforms.all) {
          const jobRole = req.body.jobRole || '';
          const rolePart = jobRole ? `"${jobRole}"` : "";
          const businessPart = business ? `"${business}"` : (keywords || "");
          const businessQuery = `${rolePart} ${businessPart} ${location} email contact`.trim();
          const generalResults = await scrapeGeneralSearch(businessQuery, limit, log, onResult, notesContext);
          totalResults = [...totalResults, ...generalResults];
        }

        log(`Scrape complete. Found ${totalResults.length} total leads.`);
      } catch (bgError) {
        console.error('Background scrape error:', bgError);
        try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] BG SCRAPE ERROR: ${bgError.stack}\n`); } catch (e) { }
        const logs = userLogs.get(userId) || [];
        logs.push({ timestamp: new Date().toLocaleTimeString(), message: `ERROR: ${bgError.message}` });
        userLogs.set(userId, logs);
      } finally {
        activeScrapes.set(userId, false);
      }
    })();

  } catch (error) {
    try { fs.appendFileSync('scraper_endpoint.log', `[${new Date().toISOString()}] CATCH BLOCK: ${error.stack}\n`); } catch (e) { }
    console.error('Scraping API Error:', error);

    if (userId) {
      const logs = userLogs.get(userId) || [];
      logs.push({ timestamp: new Date().toLocaleTimeString(), message: `ERROR: ${error.message}` });
      userLogs.set(userId, logs);
      activeScrapes.set(userId, false);
    }

    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Scraping failed'
      });
    }
  }
});


app.get('/api/emails', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const refresh = req.query.refresh === 'true';
    const syncNew = req.query.syncNew === 'true';

    // specific client for this user request
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

    // Fetch all email accounts for this user
    const { data: emailAccounts, error: accountsError } = await scopedSupabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id);

    if (accountsError) {
      throw new Error(`Failed to fetch email accounts: ${accountsError.message}`);
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return res.json({ success: true, data: [], errors: [] });
    }

    // Check if we have emails in DB
    const { count, error: countError } = await scopedSupabase
      .from('inbox_emails')
      .select('*', { count: 'exact', head: true })
      .in('email_account_id', emailAccounts.map(a => a.id));

    const shouldFullSync = refresh || count === 0;
    const shouldIncrementalSync = syncNew && !shouldFullSync;

    const accountErrors = [];

    if (shouldFullSync || shouldIncrementalSync) {
      console.log(`Syncing emails for ${emailAccounts.length} accounts...`);

      // Process accounts serially
      const TIMEOUT_MS = 60000; // Increased timeout for sync
      const MAX_CONCURRENT = 1;

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
                secure: account.imap_port === 993,
                auth: {
                  user: account.email,
                  pass: decryptedPassword
                },
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
                      console.log(`[${account.email}] Incremental sync ${folderType}: fetching UIDs from ${lastUid + 1}`);
                    } else {
                      // Full sync: fetch last 50
                      const fetchCount = 50;
                      const start = Math.max(1, total - (fetchCount - 1));
                      range = `${start}:*`;
                    }

                    for await (const message of client.fetch(range, { envelope: true, source: true, uid: true, flags: true })) {
                      const parsed = await simpleParser(message.source);
                      const isRead = message.flags && message.flags.has ? message.flags.has('\\Seen') : false;

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
                        campaign_id: parsed.headers.get('x-campaign-id') || null
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

    // Return emails from DB
    let query = scopedSupabase
      .from('inbox_emails')
      .select('*')
      .in('email_account_id', emailAccounts.map(a => a.id));

    if (req.query.campaignId && req.query.campaignId !== 'undefined') {
      query = query.eq('campaign_id', req.query.campaignId);
    }

    if (req.query.emailAccountId && req.query.emailAccountId !== 'undefined') {
      query = query.eq('email_account_id', req.query.emailAccountId);
    }

    const { data: allEmails, error: fetchError } = await query
      .order('received_at', { ascending: false })
      .limit(200); // Limit return size for performance

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
      secure: account.imap_port === 993,
      auth: { user: account.email, pass: decryptedPassword },
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
          // IMAP Delete
          const listed = await client.list();
          const trashResults = listed.find(f => f.specialUse === '\\Trash' || f.name === 'Trash' || f.name === 'Bin' || f.path === '[Gmail]/Trash');

          if (trashResults) {
            await client.messageMove(uids, trashResults.path, { uid: true });
          } else {
            await client.messageDelete(uids, { uid: true });
          }

          // DB Delete
          await scopedSupabase
            .from('inbox_emails')
            .delete()
            .eq('email_account_id', emailAccountId)
            .in('uid', uids)
            .eq('folder', folder);

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

    let emailsSentToday = 0;
    const today = new Date().toISOString().split('T')[0];

    // Check warmup settings if enabled
    if (emailAccount.warmup_enabled && emailAccount.warmup_status === 'enabled') {
      // Get today's warmup progress
      const { data: warmupProgress, error: progressError } = await scopedSupabase
        .from('email_warmup_progress')
        .select('emails_sent')
        .eq('email_account_id', emailAccountId)
        .eq('date', today)
        .single();

      if (progressError && !progressError.message.includes('No rows found')) {
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
    const senderDomain = emailAccount.email.split('@')[1];
    if (senderDomain) {
      const { data: canSend, error: limitError } = await scopedSupabase.rpc('increment_domain_email_count', {
        p_domain: senderDomain.toLowerCase(),
        p_max_limit: 50 // Default limit is 50/hour per domain
      });
      
      if (limitError) {
        console.error('Domain limit check error:', limitError);
      } else if (!canSend) {
        throw new Error(`Domain ${senderDomain} has exceeded the max emails per hour (50) allowed. Message will be reattempted later.`);
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

    // Update warmup progress if enabled
    if (emailAccount.warmup_enabled && emailAccount.warmup_status === 'enabled') {
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Log startup config
  if (!process.env.SUPABASE_URL) console.warn('WARNING: Missing SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY) console.warn('WARNING: Missing SUPABASE_ANON_KEY');
});

export default app;
