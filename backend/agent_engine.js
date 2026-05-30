const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const OpenAI = require('openai');
const { fetchAIChatCompletion } = require('./ai-client');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Replicate = require('replicate');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// 1. Initialize Clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const relaySupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

let redisConnection;
let agentQueue;
if (process.env.REDIS_URL) {
  try {
    redisConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, retryStrategy: () => null });
    redisConnection.on('error', () => {
      // suppress verbose connection errors
    });
    agentQueue = new Queue('agentTasks', { connection: redisConnection });
  } catch (e) {
    console.log("Redis not configured correctly, continuing without BullMQ for now");
  }
} else {
  console.log("[SYSTEM] No REDIS_URL found in .env, running without BullMQ.");
}

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.OPENAI_API_BASE || 'https://api.deepseek.com/v1'
});

const MODEL = process.env.MODEL || 'openrouter/owl-alpha';

// Assembly Line Pipeline - all agents report back to Boss after completion
// Boss receives pipeline-aware recommendations and delegates to the next agent
// Flow: Boss → Market Researcher → Scraper → Validator → Sales Strategist → Emailer → Boss (loop)
const PIPELINE_AGENTS = ['Market Researcher', 'Scraper', 'Validator', 'Sales Strategist', 'Emailer'];

// Valid agent names for delegation — prevents garbled names from AI output
const VALID_AGENTS = ['Boss', 'Market Researcher', 'Scraper', 'Validator', 'Sales Strategist', 'Emailer'];

function resolveAgentName(raw) {
  const cleaned = (raw || '').replace(/[*`_~#>]/g, '').trim();
  // Exact match (case-insensitive)
  const exact = VALID_AGENTS.find(a => a.toLowerCase() === cleaned.toLowerCase());
  if (exact) return exact;
  // Partial match — does the raw string START with a valid agent name?
  const partial = VALID_AGENTS.find(a => cleaned.toLowerCase().startsWith(a.toLowerCase()));
  if (partial) return partial;
  // Reverse partial — does a valid agent name START with the cleaned input? (catches "Scrape" → "Scraper", "Market" → "Market Researcher")
  const reversePartial = VALID_AGENTS.find(a => a.toLowerCase().startsWith(cleaned.toLowerCase()) && cleaned.length >= 3);
  if (reversePartial) return reversePartial;
  // Substring match — does the raw string CONTAIN a valid agent name?
  const substring = VALID_AGENTS.find(a => cleaned.toLowerCase().includes(a.toLowerCase()));
  if (substring) return substring;
  console.warn(`[AGENT NAME WARNING] Could not resolve "${cleaned}" to a known agent. Using raw value.`);
  return cleaned;
}

// 2. Rate Limiting State (Max 20 per minute)
const API_CALLS = [];
const RATE_LIMIT_PER_MINUTE = 20;

async function checkRateLimit() {
  const oneMinuteAgo = Date.now() - 60000;
  // Remove calls older than 1 minute
  while (API_CALLS.length > 0 && API_CALLS[0] < oneMinuteAgo) {
    API_CALLS.shift();
  }
  
  if (API_CALLS.length >= RATE_LIMIT_PER_MINUTE) {
    const waitTime = 60000 - (Date.now() - API_CALLS[0]);
    console.log(`[RATE LIMIT] Reached ${RATE_LIMIT_PER_MINUTE} msgs/min. Waiting ${Math.ceil(waitTime/1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return checkRateLimit(); // Re-check after waiting
  }
  
  API_CALLS.push(Date.now());
}

// 3. Web Scraping Tool
async function scrapeUrl(url) {
  console.log(`[PUPPETEER] Navigating to ${url}...`);
  try {
    const browser = await puppeteer.launch({ 
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--js-flags=--max-old-space-size=256'
      ]
    });
    const page = await browser.newPage();
    
    // Resource Blocking
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Extract basic text content
    const textContent = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('nav, footer, script, style, noscript, iframe, svg').forEach(b => b.remove());
      return clone.innerText.replace(/\s+/g, ' ').substring(0, 3000); 
    });
    
    await browser.close();
    console.log(`[PUPPETEER] Successfully scraped ${url}`);
    return textContent;
  } catch (err) {
    console.error(`[PUPPETEER ERROR]: ${err.message}`);
    return `Error scraping URL: ${err.message}`;
  }
}

// 4. Agent Execution Loop
async function processTask(task) {
  console.log(`\n=================================================`);
  console.log(`[TASK PICKED UP] ID: ${task.id} | Agent: ${task.assigned_to}`);
  
  // Mark in progress (Shows Green Dot on UI) and reset progress
  await supabase.from('tasks').update({ status: 'in_progress', progress: 0 }).eq('id', task.id);

  try {
    // Fetch Agent Instructions
    const { data: agentData } = await supabase
      .from('agents')
      .select('instructions')
      .eq('name', task.assigned_to)
      .single();

    const instructions = agentData ? agentData.instructions : "You are a helpful assistant.";

    const currentDateTime = new Date().toLocaleString();
    
    // Fetch global active business context for all agents
    let globalBusinessContext = 'PTN Relay Solutions';
    let timelineContext = '';
    try {
      const { data: activeBiz } = await supabase.from('businesses').select('*').eq('status', 'active');
      if (activeBiz && activeBiz.length > 0) {
        globalBusinessContext = activeBiz.map(b => b.name).join(' and ');
        
        // Fetch active timelines and overviews
        for (const biz of activeBiz) {
          if (biz.overview_md) {
             timelineContext += `\n[BUSINESS OVERVIEW & GOALS: ${biz.name}]\n${biz.overview_md}\n`;
          }
          
          // Inject live metrics
          const { count: campaignsCount } = await supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('business_id', biz.id);
          const { data: targetsData } = await supabase.from('business_targets').select('*').eq('business_id', biz.id);
          const activeTargets = targetsData ? targetsData.filter(t => t.status !== 'deleted') : [];
          
          timelineContext += `\n[LIVE METRICS: ${biz.name}]\n- Active Campaigns Built: ${campaignsCount || 0}\n- Active Targets Defined: ${activeTargets.length}\n`;
          if (activeTargets.length > 0) {
            timelineContext += `- Target List: ${activeTargets.map(t => `"${t.name}"`).join(', ')}\n`;
          }
          timelineContext += `*(Boss Agent: Read these metrics before generating a timeline so you don't repeat work. If campaigns or targets already exist, use them rather than creating from scratch.)*\n`;

          const { data: bTasks } = await supabase.from('business_tasks').select('*').eq('business_id', biz.id).order('step_number', { ascending: true });
          if (bTasks && bTasks.length > 0) {
            timelineContext += `\n[TIMELINE: ${biz.name} (ID: ${biz.id})]\n`;
            bTasks.forEach(t => {
              timelineContext += `${t.step_number}. [${t.status.toUpperCase()}] ${t.description}\n`;
            });
          }
        }
      }
    } catch(e) {}

    // Truncate task description if it is massive to prevent API crashes
    const safeDescription = task.description.length > 10000 
      ? task.description.substring(0, 10000) + "... [Truncated by System due to size]" 
      : task.description;

    let messages = [
      { role: "system", content: `${instructions}

You are an elite operative of **Openclaw Factory**, the world's most advanced autonomous B2B growth agency. We operate the **${globalBusinessContext}** infrastructure.

### 🚨 CRITICAL RULE — ACTIVE BUSINESS CONTEXT:
The currently ACTIVE businesses you must focus on are: **${globalBusinessContext}**.
${timelineContext}
If you are generating leads, writing copy, or researching, you MUST align your targeting, locations, and value propositions exactly with these active businesses. Do NOT use defaults from disabled businesses (e.g., do not scrape the US if the active business is MrMedic, which is UK only).
When using SCRAPE or RECRUIT_LEADS, NEVER use broad regions like 'United Kingdom', 'UK', or 'USA'. Google Maps will fail to find leads on broad country searches. You MUST use specific cities, and ideally, break down large cities into specific boroughs, towns, or districts (e.g., instead of just 'London', use 'Camden, London', 'Islington, London', 'Croydon'). This bypasses the Google Maps result limits and ensures we capture all actual businesses.

### OPERATIONAL PRINCIPLES:
1. **The Assembly Line**: We operate as a high-speed pipeline. Respect the flow: Boss -> Market Researcher -> Scraper -> Validator -> Sales Strategist -> Emailer.
2. **Strict Delegation**: Do NOT perform tasks that belong to another agent. Use the DELEGATE command to pass work down the line.
3. **Simultaneous Execution**: Once you delegate, your part of the task is done. The system will automatically report your results back to the Boss.
4. **FULL AUTONOMY**: You are an autonomous agent. NEVER stop to ask for permission or clarification. Work with the data you have. If information is missing, use PUPPETEER to research it or make a reasonable decision.
5. **Professionalism**: Be punchy, results-driven, and use emojis 🚀.
6. **English Only**: Always respond in English.

### 🚨 CRITICAL RULES — CAMPAIGN CREATION & BROAD TARGETING:
- **AVOID REDUNDANCY**: We want a BROAD target. Before creating a new campaign, you MUST check if a similar campaign already exists (same niche, same keywords, or same copy).
- **UNIQUE NICHES**: Do NOT target the same industry in the same location twice. 
- **LIST FIRST**: Always call \`RELAY_API: LIST_CAMPAIGNS\` before creating a new one to see what's already running.
- **NEVER invent or guess campaign IDs.** Campaign IDs are UUIDs like "a1b2c3d4-e5f6-7890-abcd-ef1234567890".
- **ALWAYS call \`RELAY_API: LIST_CAMPAIGNS\` first** to get real campaign IDs before using any other RELAY_API command.
- If \`LIST_CAMPAIGNS\` returns an empty array, you MUST call \`RELAY_API: CREATE_CAMPAIGN\` first.
- Strings like "camp_20260512_001" or "camp-ai-saas-austin-01" are NOT valid campaign IDs. The system will reject them.

### 🚨 CRITICAL RULES — PREREQUISITE CHECKS:
Before proceeding with any pipeline step, verify these prerequisites:
- **RELAY_API: RECRUIT_LEADS | {"niche": "string", "location": "string", "campaignId": "uuid"}** - SCRAPER ONLY. Trigger Hermes AI to perform an autonomous, high-intelligence lead recruitment mission. Use this when the standard SCRAPE tool returns poor results or when high-quality research is needed.
- **RELAY_API: SCRAPE | {"business": "string", "location": "string", "campaignId": "uuid"}** - SCRAPER ONLY. Perform a standard web/maps scrape for leads.
- **Before GENERATE_SEQUENCE**: Campaign must exist AND must have leads (prospects > 0). If no leads, delegate to Scraper.
- **Before ACTIVATE_SCHEDULE**: Campaign must have templates, leads, AND email accounts.
- **If prerequisites are NOT met**: Do NOT proceed. Report back what's missing and delegate to the correct agent to fix it.

### COMMANDS (USE EXACTLY):
- **DELEGATE: <AgentName> | <Task Description>** - Pass a task to the next agent in the assembly line. ALWAYS include all relevant data (locations, campaign IDs, keywords) in the description.
- **HERMES: <prompt>** - BOSS, MARKET RESEARCHER, SALES STRATEGIST ONLY. Use the local Hermes AI (Llama 3 + Skills) to perform complex, multi-step tasks like deep-diving into a niche, identifying competitors, extracting value propositions from websites, or researching buying signals. Hermes has access to advanced skills like duckduckgo-search and web-search.
- **PUPPETEER: <url>** - Research or scrape a specific web page.
- **WHATSAPP: <message>** - BOSS ONLY. Other agents: DO NOT USE THIS. You will be blocked.
- **RELAY_API: UPDATE_BUSINESS_TIMELINE | {"businessId": "UUID", "tasks": [{"step": 1, "desc": "...", "status": "pending"}]}** - BOSS ONLY. Replaces the current business timeline with up to 10 sequential tasks for the agents to follow.
- **RELAY_API: CREATE_TARGET | {"businessId": "UUID", "name": "...", "description": "..."}** - BOSS ONLY. Creates a new business target. CRITICAL: The name MUST be action-oriented and specific to the overarching business goals (e.g. "Get bookings for AI Automation & Systems", "Get clients for Website Development and renovation", "Book demos for our HR software"). Do NOT just use generic nouns.
- **RELAY_API: UPDATE_CAMPAIGN | {"campaignId": "UUID", "name": "...", "niche": "...", "objective": "...", "status": "...", "business_id": "UUID"}** - BOSS ONLY. Updates an existing campaign's details.
- **RELAY_API: DELETE_CAMPAIGN | {"campaignId": "UUID"}** - BOSS ONLY. Deletes a campaign.
- **RELAY_API: PAUSE_CAMPAIGN | {"campaignId": "UUID"}** - BOSS ONLY. Pauses a campaign (sets status to paused).
- **RELAY_API: RESUME_CAMPAIGN | {"campaignId": "UUID"}** - BOSS ONLY. Resumes a paused campaign (sets status to active).
- **GENERATE_IMAGE: <prompt>** - Generate high-quality visual assets for reports or campaigns.

*Note: You may have additional RELAY_API tools listed in your specific instructions above. Use them only if they are explicitly assigned to your role.*

### FORMATTING:
- Use rich Markdown (headers, tables, bold).
- Embed generated images using ![alt](url).
- Wrap your internal reasoning in <thought>...</thought> tags before your final response.` },
      { role: "user", content: `[REAL-TIME CLOCK]: ${currentDateTime}\n\nYour current task is: ${safeDescription}` }
    ];

    let isFinished = false;
    let loopCount = 0;
    let delegatedDuringTask = false;
    const MAX_LOOPS = 6; // Prevent infinite loops

    while (!isFinished && loopCount < MAX_LOOPS) {
      loopCount++;
      await checkRateLimit();
      
      const response = await fetchAIChatCompletion({
        model: MODEL,
        messages: messages
      });

      const aiText = response.choices[0].message.content || '';
      console.log(`[AI RESPONSE]: ${aiText}`);

      // Broadcast to Relay Neural Feed
      const thoughtMatchGlobal = aiText.match(/<(thought|think)>([\s\S]*?)<\/(thought|think)>/i);
      const resolvedAgentName = resolveAgentName(task.assigned_to);
      if (thoughtMatchGlobal && VALID_AGENTS.some(a => resolvedAgentName.toLowerCase().includes(a.toLowerCase()))) {
         const thoughtLog = `[${resolvedAgentName.toUpperCase()}]: ${thoughtMatchGlobal[2].trim()}`;
         const adminUserId = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
         try {
           await relaySupabase.from('scraper_logs').insert([{ user_id: adminUserId, message: thoughtLog }]);
           const channel = relaySupabase.channel(`scraped-leads-${adminUserId}`);
           channel.subscribe((status) => {
             if (status === 'SUBSCRIBED') {
                channel.send({ type: 'broadcast', event: 'scrape-log', payload: { timestamp: new Date().toISOString(), message: thoughtLog }});
                setTimeout(() => relaySupabase.removeChannel(channel), 1000);
             }
           });
         } catch(e) {
           console.error("[NEURAL FEED ERROR]", e.message);
         }
      }

      // Strip <thought> or <think> blocks before matching commands to prevent false triggers
      let cleanAiText = aiText.replace(/<(thought|think)>[\s\S]*?<\/(thought|think)>/gi, '').trim();
      
      // Fix Gemini/OpenRouter tool hallucination formats
      if (cleanAiText.includes('<longcat_tool_call>')) {
         const methodMatch = cleanAiText.match(/<longcat_arg_value>\s*([A-Z_]+)\s*(?:<\/longcat_arg_value>|\n|$)/i);
         const inlineMatch = cleanAiText.match(/<longcat_tool_call>\s*RELAY_API:\s*([A-Z_]+)/i);
         if (methodMatch) {
             cleanAiText = `RELAY_API: ${methodMatch[1]}`;
         } else if (inlineMatch) {
             cleanAiText = `RELAY_API: ${inlineMatch[1]}`;
         }
      }

      // Check for Puppeteer command
      const puppeteerMatch = cleanAiText.match(/^[ \t`*]*PUPPETEER:\s*(https?:\/\/[^\s*"'<>]+)/im);
      // Check for Delegate command — tighter regex: agent name is 1-3 capitalized words before | or :
      const delegateMatch = cleanAiText.match(/^[ \t`*]*DELEGATE\s*(?:TO)?\s*:?\s*\*{0,2}\s*([A-Za-z][A-Za-z ]{0,30}?)\s*\*{0,2}\s*(?:\||:|—|–)\s*([\s\S]+)/im);
      // Check for Generate Image command
      const generateImageMatch = cleanAiText.match(/^[ \t`*]*GENERATE_IMAGE:\s*(.+)/im);
      // Check for WhatsApp command
      const whatsappMatch = cleanAiText.match(/^[ \t`*]*WHATSAPP:\s*(.+)/im);
      // Check for Relay API command (payload is optional)
      const relayApiMatch = cleanAiText.match(/^[ \t`*]*RELAY_API:\s*([A-Z_]+)(?:\s*\|\s*(\{[\s\S]*?\}))?/im);
      // Check for Hermes command
      const hermesMatch = cleanAiText.match(/^[ \t`*]*HERMES:\s*(.+)/im);

      // Process WhatsApp command independently (so agents can notify AND act)
      if (whatsappMatch) {
        const waMsg = whatsappMatch[1].trim();
        
        // ONLY the Boss can use WhatsApp — pipeline agents must work autonomously
        if (task.assigned_to !== 'Boss') {
          console.log(`[WHATSAPP BLOCKED] ${task.assigned_to} tried to message Boss. Redirecting to autonomous action.`);
          messages.push({ role: "assistant", content: cleanAiText });
          messages.push({ role: "user", content: `SYSTEM OVERRIDE: You are NOT allowed to use WHATSAPP. Only the Boss can contact the human owner. You are an autonomous agent — work with the data you have. If you are missing information, use PUPPETEER to research it yourself, or use RELAY_API: LIST_LEADS / LIST_CAMPAIGNS to get current data. If you truly cannot proceed, use DELEGATE to pass the task back to the Boss with a status report. DO NOT call WHATSAPP again.` });
        } else {
          console.log(`[WHATSAPP SENDING] ${waMsg}`);
          
          await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Messaging Boss</thought> Sent WhatsApp message: ${waMsg}` }]);
          
          if (global.whatsappClientReady) {
             const bossNumber = process.env.BOSS_WHATSAPP_NUMBER || 'placeholder';
              global.whatsappClient.sendMessage(bossNumber + '@c.us', waMsg);
              console.log("[WHATSAPP] Sent message to", bossNumber);
          }
          
          // If this is the ONLY command, mark as waiting and break the loop
          // Otherwise, let it continue to process the other commands (like DELEGATE)
          if (!puppeteerMatch && !relayApiMatch && !delegateMatch && !generateImageMatch) {
            await supabase.from('tasks').update({ status: 'waiting_for_reply', description: task.description + "\n\nWaiting for user reply to: " + waMsg }).eq('id', task.id);
            isFinished = true;
            return; // exit the processTask execution early
          }
        }
      }

      if (puppeteerMatch) {
        const url = puppeteerMatch[1].trim();
        
        if (url.includes('{') && url.includes('}')) {
          console.log(`[PUPPETEER BLOCKED] AI attempted to use placeholders in URL: ${url}`);
          await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Blocked</thought> I attempted to browse a URL with placeholders. I need to fix it.` }]);
          messages.push({ role: "assistant", content: cleanAiText });
          messages.push({ role: "user", content: `SYSTEM ERROR: You attempted to use a placeholder in your PUPPETEER URL ("${url}"). You must substitute actual concrete values for parameters like niche, keywords, location, etc. Please try again with a real, fully-formed URL.` });
        } else {
          // Log status back to UI chat, show Yellow dot because we are waiting on the web request
          await supabase.from('tasks').update({ status: 'waiting' }).eq('id', task.id);
          await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Browsing ${url}</thought> I am researching online at: ${url}...` }]);
          
          const scrapedText = await scrapeUrl(url);
          
          // Return to Green dot
          await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
          
          messages.push({ role: "assistant", content: cleanAiText });
          messages.push({ role: "user", content: `Web page content:\n\n${scrapedText}\n\nPlease proceed with answering the task based on this information.` });
        }

      } else if (generateImageMatch) {
        const inputStr = generateImageMatch[1].trim();
        console.log(`[IMAGE GEN] Generating image for: ${inputStr}`);
        
        await supabase.from('tasks').update({ status: 'waiting' }).eq('id', task.id);
        await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Generating Image</thought> Designing concept: ${inputStr}` }]);
        
        try {
           const seed = Math.floor(Math.random() * 1000000);
           const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(inputStr)}?seed=${seed}&nologo=true&width=1024&height=1024`;
           await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
           messages.push({ role: "assistant", content: cleanAiText });
           messages.push({ role: "user", content: `Image generation complete. Result URL:\n${imgUrl}\n\nPlease proceed and MAKE SURE to embed this image using markdown ![alt](${imgUrl}) in your final response.` });
        } catch (e) {
           await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
           messages.push({ role: "assistant", content: cleanAiText });
           messages.push({ role: "user", content: `Image generation failed: ${e.message}` });
        }

      } else if (hermesMatch) {
        const hPrompt = hermesMatch[1].trim();
        console.log(`[HERMES] Calling Hermes for: ${hPrompt}`);
        
        await supabase.from('tasks').update({ status: 'waiting' }).eq('id', task.id);
        await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Consulting Hermes AI</thought> I am triggering Hermes AI for specialized research: ${hPrompt}` }]);
        
        try {
          const memoryPrompt = `[PIPELINE MEMORY]\nCurrent Timeline Status:\n${timelineContext}\n\nTask: ${hPrompt}`;

          const res = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/hermes/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: memoryPrompt, yolo: true, sessionName: 'boss_pipeline' })
          });
          const hData = await res.json();
          
          await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
          
          if (hData.success) {
            messages.push({ role: "assistant", content: cleanAiText });
            messages.push({ role: "user", content: `Hermes AI Result:\n\n${hData.response}\n\nPlease integrate this research into your response.` });
          } else {
            messages.push({ role: "assistant", content: cleanAiText });
            messages.push({ role: "user", content: `Hermes AI failed: ${hData.error}` });
          }
        } catch (e) {
          await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
          messages.push({ role: "assistant", content: cleanAiText });
          messages.push({ role: "user", content: `Hermes AI Connection failed: ${e.message}` });
        }

      } else if (relayApiMatch) {
        const action = relayApiMatch[1].trim();
        let payloadStr = relayApiMatch[2] ? relayApiMatch[2].trim() : "{}";
        
        // Fallback: If payload is empty but there is a JSON code block, use that
        if (payloadStr === "{}" || payloadStr === "") {
          const jsonBlockMatch = aiText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
          if (jsonBlockMatch) {
            payloadStr = jsonBlockMatch[1].trim();
          }
        }
        console.log(`[RELAY API] Action: ${action} Payload: ${payloadStr}`);
        
        await supabase.from('tasks').update({ status: 'waiting' }).eq('id', task.id);
        const thoughtMatch = aiText.match(/<(thought|think)>([\s\S]*?)<\/(thought|think)>/i);
        const thought = thoughtMatch ? thoughtMatch[2].trim() : "Executing Relay operation...";
        
        await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>${thought}</thought> Executing ${action} on Relay Backend...` }]);
        
        // Logic moved below auth
        
        try {
          const payload = payloadStr ? JSON.parse(payloadStr) : {};
          
          // ═══ UUID VALIDATION GATE ═══
          // Reject hallucinated campaign IDs before they hit the database
          const CAMPAIGN_ACTIONS = ['SCRAPE', 'GENERATE_SEQUENCE', 'ASSIGN_LEADS', 'ADD_LEADS_TO_CAMPAIGN', 'ACTIVATE_SCHEDULE', 'SET_OBJECTIVE', 'UPDATE_PROSPECTS', 'ASSIGN_EMAIL_ACCOUNTS'];
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          
          if (CAMPAIGN_ACTIONS.includes(action) && payload.campaignId && !UUID_REGEX.test(payload.campaignId)) {
            console.log(`[UUID GATE] Rejected hallucinated campaignId: "${payload.campaignId}"`);
            await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
            messages.push({ role: "assistant", content: cleanAiText });
            messages.push({ role: "user", content: `SYSTEM ERROR: The campaignId "${payload.campaignId}" is NOT a valid UUID. Campaign IDs must be real UUIDs like "a1b2c3d4-e5f6-7890-abcd-ef1234567890". You MUST call RELAY_API: LIST_CAMPAIGNS first to get real campaign IDs. If no campaigns exist, call RELAY_API: CREATE_CAMPAIGN to create one. NEVER invent campaign IDs.` });
            continue;
          }

          // Sign in to get JWT token for Relay API
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: 'ptnmgmt@gmail.com',
            password: 'Longlonglong1!'
          });
          
          if (authError || !authData.session) {
             throw new Error(`Auth failed: ${authError?.message}`);
          }
          
          const token = authData.session.access_token;
          const userId = authData.user.id;

          // Create a fresh client scoped to this user's session for RLS safety
          const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });

          let endpoint = '';
          let result = {};

          // ═══ PREREQUISITE VALIDATION FOR CAMPAIGN-DEPENDENT ACTIONS ═══
          if (CAMPAIGN_ACTIONS.includes(action) && action !== 'SCRAPE' && payload.campaignId) {
            // Verify the campaign actually exists
            const { data: campaignCheck, error: campaignCheckErr } = await client.from('campaigns')
              .select('id, name, prospects, niche')
              .eq('id', payload.campaignId)
              .maybeSingle();
            
            if (!campaignCheck) {
              console.log(`[PREREQUISITE FAIL] Campaign ${payload.campaignId} does not exist.`);
              await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
              messages.push({ role: "assistant", content: cleanAiText });
              messages.push({ role: "user", content: `PREREQUISITE FAILURE: Campaign "${payload.campaignId}" does NOT exist in the database. Call RELAY_API: LIST_CAMPAIGNS to see which campaigns exist. If none exist, call RELAY_API: CREATE_CAMPAIGN to create one first. Then retry this action.` });
              continue;
            }

            // For GENERATE_SEQUENCE and ACTIVATE_SCHEDULE, check if leads exist
            if (action === 'GENERATE_SEQUENCE' || action === 'ACTIVATE_SCHEDULE') {
              const { count: leadCount } = await client.from('campaign_leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', payload.campaignId);
              
              if (!leadCount || leadCount === 0) {
                console.log(`[PREREQUISITE FAIL] Campaign ${payload.campaignId} has 0 leads.`);
                await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
                messages.push({ role: "assistant", content: cleanAiText });
                messages.push({ role: "user", content: `PREREQUISITE FAILURE: Campaign "${campaignCheck.name}" (${payload.campaignId}) has 0 leads. You cannot ${action === 'GENERATE_SEQUENCE' ? 'generate email sequences' : 'activate the schedule'} without leads. The Scraper must scrape leads first. DELEGATE to the Scraper or report this gap to the Boss.` });
                continue;
              }
            }
          }
          
          if (action === 'CREATE_TASKLIST') {
            const { businessId, steps } = payload;
            if (!businessId || !steps || !Array.isArray(steps)) {
              throw new Error('businessId and steps array are required for CREATE_TASKLIST');
            }
            const tasklistData = steps.map((desc, idx) => ({
              step_number: idx + 1,
              description: desc,
              status: idx === 0 ? 'in_progress' : 'pending'
            }));
            
            // Check if one already exists
            const { data: existing } = await client.from('tasks').select('id').eq('assigned_to', `__TASKLIST__${businessId}`).maybeSingle();
            
            if (existing) {
              await client.from('tasks').update({
                description: JSON.stringify(tasklistData)
              }).eq('id', existing.id);
            } else {
              await client.from('tasks').insert([{
                assigned_to: `__TASKLIST__${businessId}`,
                description: JSON.stringify(tasklistData),
                status: 'active'
              }]);
            }
            result = { success: true, message: 'Timeline generated successfully' };
          } else if (action === 'UPDATE_TASKLIST_STEP') {
            const { businessId, stepNumber, status } = payload;
            if (!businessId || !stepNumber || !status) {
              throw new Error('businessId, stepNumber, and status are required for UPDATE_TASKLIST_STEP');
            }
            
            const { data: existing } = await client.from('tasks').select('id, description').eq('assigned_to', `__TASKLIST__${businessId}`).single();
            if (!existing) throw new Error('No timeline exists for this business');
            
            const tasklistData = JSON.parse(existing.description);
            const stepIndex = tasklistData.findIndex(t => t.step_number === parseInt(stepNumber));
            
            if (stepIndex === -1) throw new Error(`Step ${stepNumber} not found in timeline`);
            
            tasklistData[stepIndex].status = status;
            
            // Auto-advance next step to in_progress if current is completed
            if (status === 'completed' && stepIndex + 1 < tasklistData.length) {
              tasklistData[stepIndex + 1].status = 'in_progress';
            }
            
            await client.from('tasks').update({
              description: JSON.stringify(tasklistData)
            }).eq('id', existing.id);
            
            result = { success: true, message: `Step ${stepNumber} updated to ${status}` };
          } else if (action === 'SCRAPE') {
            if (task.assigned_to !== 'Scraper') {
               console.log(`[SECURITY] Blocking ${task.assigned_to} from calling SCRAPE directly.`);
               messages.push({ role: "assistant", content: cleanAiText });
               messages.push({ role: "user", content: `CRITICAL ERROR: You are ${task.assigned_to}. You are FORBIDDEN from calling RELAY_API: SCRAPE directly. This violates the Assembly Line Protocol. ONLY the Scraper agent is allowed to execute scrape tools. You must DELEGATE the scraping task to the Scraper. Please re-read your instructions and delegate now.` });
               continue;
            }
            // Normalization: Ensure business and location are set
            const scrapePayload = { ...payload, taskId: task.id };
            if (!scrapePayload.business && scrapePayload.niche) scrapePayload.business = scrapePayload.niche;
            if (!scrapePayload.business && scrapePayload.query) scrapePayload.business = scrapePayload.query;
            if (!scrapePayload.location && scrapePayload.target) scrapePayload.location = scrapePayload.target;
            
            // Fallback: If campaignId is missing, try to extract from task description
            if (!scrapePayload.campaignId && task.description) {
              const campIdMatch = task.description.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
              if (campIdMatch) {
                scrapePayload.campaignId = campIdMatch[1];
                console.log(`[FALLBACK] Extracted campaignId from task: ${scrapePayload.campaignId}`);
              }
            }
            
            // Clean up if "in" is present in business (e.g. "rugby clubs in London")
            if (!scrapePayload.location && scrapePayload.business) {
                const inMatch = scrapePayload.business.match(/\s+in\s+(.+)$/i);
                if (inMatch) {
                    scrapePayload.location = inMatch[1].trim();
                    scrapePayload.business = scrapePayload.business.substring(0, inMatch.index).trim();
                    console.log(`[NORMALIZATION] Split business to "${scrapePayload.business}" in "${scrapePayload.location}"`);
                }
            }
            
            // Fallback: If location is missing, try to extract from task description (broader regex)
            if (!scrapePayload.location && task.description) {
              const locMatch = task.description.match(/in\s+\**([A-Za-z\s,]+)\**/i);
              if (locMatch) {
                scrapePayload.location = locMatch[1].trim();
                console.log(`[FALLBACK] Extracted location from task: ${scrapePayload.location}`);
              }
            }
            
            if (!scrapePayload.location) {
               throw new Error('location is REQUIRED for SCRAPE. Please provide the location parameter (e.g. "London, UK") in your JSON payload.');
            }
            if (!scrapePayload.business) {
               throw new Error('business is REQUIRED for SCRAPE. Please provide the business parameter (e.g. "rugby clubs") in your JSON payload.');
            }
            
            // Fallback: If business is missing, try to extract from task description
            if (!scrapePayload.business && task.description) {
              const bizMatch = task.description.match(/Target:\s*([A-Za-z\s]+)\s+in/i) || task.description.match(/Scrape\s+leads\s+for\s+([A-Za-z\s]+)\s+in/i);
              if (bizMatch) {
                scrapePayload.business = bizMatch[1].trim();
                console.log(`[FALLBACK] Extracted business from task: ${scrapePayload.business}`);
              }
            }
            
            // Fallback: If business is still missing, fetch campaign niche
            if (!scrapePayload.business && scrapePayload.campaignId) {
              const { data: camp } = await client.from('campaigns').select('niche').eq('id', scrapePayload.campaignId).single();
              if (camp && camp.niche) {
                scrapePayload.business = camp.niche;
                console.log(`[FALLBACK] Fetched business (niche) from DB: ${scrapePayload.business}`);
              }
            }
            
            endpoint = `http://127.0.0.1:${process.env.PORT || 3000}/api/scrape-leads`;
            const res = await fetch(endpoint, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
               body: JSON.stringify(scrapePayload)
            });
            result = await res.json();
          } else if (action === 'RECRUIT_LEADS') {
            if (task.assigned_to !== 'Scraper') {
               console.log(`[SECURITY] Blocking ${task.assigned_to} from calling RECRUIT_LEADS directly.`);
               messages.push({ role: "assistant", content: cleanAiText });
               messages.push({ role: "user", content: `CRITICAL ERROR: You are ${task.assigned_to}. You are FORBIDDEN from calling RELAY_API: RECRUIT_LEADS directly. This violates the Assembly Line Protocol. ONLY the Scraper agent is allowed to execute recruit tools. You must DELEGATE the recruiting task to the Scraper. Please re-read your instructions and delegate now.` });
               continue;
            }
            const { niche, location, campaignId } = payload;
            if (!niche || !location || !campaignId) {
               throw new Error('niche, location, and campaignId are required for RECRUIT_LEADS');
            }

            const hPrompt = `Find 50 new B2B business leads for the niche "${niche}" in the location "${location}". 
            CRITICAL: We ONLY want leads with valid work email addresses. 
            Return them as a JSON array of objects with fields: name, email, website, description, company, location. 
            Only return the JSON. No talk.`;
            
            console.log(`[RECRUIT_LEADS] Triggering Hermes recruitment for ${niche} in ${location}...`);
            
            await client.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Recruiting Leads via Hermes</thought> I am launching an autonomous recruitment mission for "${niche}" leads in "${location}" using Hermes AI...` }]);

            const hRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/hermes/chat`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ message: hPrompt, yolo: true })
            });
            const hData = await hRes.json();
            
            if (hData.success) {
               // Parse and Save
               try {
                  const resultStr = hData.response;
                  const jsonStart = resultStr.indexOf('[');
                  const jsonEnd = resultStr.lastIndexOf(']') + 1;
                  if (jsonStart === -1 || jsonEnd === 0) throw new Error("No JSON array found in Hermes output");
                  const leads = JSON.parse(resultStr.substring(jsonStart, jsonEnd));
                  
                  let added = 0;
                  const inserts = [];
                  for (const lead of leads) {
                    if (!lead.email || !lead.email.includes('@')) continue;
                    const { campaign_id, ...leadData } = lead;
                    inserts.push({
                      ...leadData,
                      user_id: authData.user.id,
                      status: 'new',
                      source: 'hermes_recruit'
                    });
                    added++;
                  }
                  
                  if (inserts.length > 0) {
                    // 1. Upsert into leads table
                    const { data: insertedLeads, error: upsertErr } = await client.from('leads').upsert(inserts, { onConflict: 'email,user_id' }).select('id');
                    if (upsertErr) throw upsertErr;
                    
                    if (insertedLeads && insertedLeads.length > 0) {
                      // 2. Link to campaign in campaign_leads junction table
                      const clInserts = insertedLeads.map(l => ({ 
                        campaign_id: campaignId, 
                        lead_id: l.id,
                        status: 'pending'
                      }));
                      
                      const { error: linkErr } = await client.from('campaign_leads').upsert(clInserts, { onConflict: 'campaign_id,lead_id' });
                      if (linkErr) console.error('[RECRUIT_LEADS] Link error:', linkErr.message);
                      
                      // 3. Update campaign prospect count
                      const { count: totalLeads } = await client.from('campaign_leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('campaign_id', campaignId);
                      await client.from('campaigns').update({ prospects: totalLeads || added }).eq('id', campaignId);
                    }
                  }
                  
                  result = { success: true, message: `Hermes found and processed ${added} leads.`, leadCount: added };
               } catch (e) {
                  result = { success: false, error: `Failed to parse Hermes leads: ${e.message}`, raw: hData.response };
               }
            } else {
               result = { success: false, error: hData.error };
            }

          } else if (action === 'CREATE_CAMPAIGN') {
            let business_id = payload.business_id || payload.businessId || null;
            let target_id = payload.target_id || payload.targetId || null;
            
            // If not explicitly provided, try to resolve dynamically
            if (!business_id) {
              const searchStr = `${payload.name} ${payload.niche || ''}`.toLowerCase();
              const mrMedicKeywords = [
                'medic', 'first aid', 'event', 'venue', 'wedding', 'catering', 'caterer', 
                'rugby', 'gymnastics', 'dance', 'conference', 'festival', 'hospitality', 'hotel'
              ];
              if (mrMedicKeywords.some(keyword => searchStr.includes(keyword))) {
                business_id = '0269fe06-4607-4c58-9263-12a3930a1dc3'; // MrMedic
              } else {
                business_id = '102a3bca-7b0a-4cee-bd33-fefd7b4450b4'; // Relay Solutions
              }
            }

            // ═══ ENHANCED CAMPAIGN LIMIT LOGIC ═══
            // We allow up to 5 ACTIVE campaigns PER BUSINESS.
            // A campaign is NOT active if it's "Completed" OR "Waiting for next steps" (Current step finished, next step in future).
            
            const { data: allCamps, error: campsErr } = await client.from('campaigns')
              .select(`
                id, name, status, business_id,
                businesses(id, status),
                scheduled_emails(id, scheduled_for, sent_emails, total_emails, status)
              `)
              .eq('user_id', authData.user.id);

            if (campsErr) throw campsErr;

            const now = new Date();
            const activeCampaigns = (allCamps || []).filter(camp => {
              // 0. Only count campaigns for the same business
              if (camp.business_id !== business_id) return false;

              // 0.5. If the parent business is inactive, the campaign is NOT active!
              if (camp.businesses && camp.businesses.status === 'inactive') return false;

              // 1. Explicitly completed campaigns are NOT active
              if (camp.status?.toLowerCase() === 'completed') return false;

              // 2. If it has NO schedules, it's a new/draft campaign -> ACTIVE
              if (!camp.scheduled_emails || camp.scheduled_emails.length === 0) return true;

              // 3. Check if any CURRENTLY DUE schedule is not finished
              const hasActiveSchedule = camp.scheduled_emails.some(s => {
                const isDue = new Date(s.scheduled_for) <= now;
                const isNotFinished = (s.sent_emails || 0) < (s.total_emails || 0);
                const isScheduled = s.status === 'scheduled';
                return isDue && isNotFinished && isScheduled;
              });

              return hasActiveSchedule;
            });

            const activeCount = activeCampaigns.length;
            const totalCount = allCamps.length;

            if (activeCount >= 5) {
              console.log(`[LIMIT REACHED] Denied creation of campaign "${payload.name}". Active: ${activeCount}, Total: ${totalCount}`);
              result = { 
                error: "Active campaign limit reached (Max 5)", 
                message: `You currently have ${activeCount} active campaigns. You MUST finish or delete existing campaigns before creating new ones. Note: Campaigns that are 100% complete or waiting for their next scheduled step do not count towards this limit.`,
                activeCount,
                totalCount
              };
            } else {
              // ═══ SIMILARITY GUARD (BROAD TARGETING) ═══
              // Check if a similar niche/objective already exists to ensure broad targeting
              if (allCamps && allCamps.length > 0) {
                const existingSummary = allCamps.map(c => `- ${c.name} (Niche: ${c.niche}, Obj: ${c.objective})`).join('\n');
                const similarityResponse = await fetchAIChatCompletion({
                  model: MODEL,
                  messages: [
                    { role: 'system', content: 'You are a campaign redundancy and niche cap checker. Compare the proposed new campaign with existing ones. We enforce a limit of max 2 campaigns per niche/industry (e.g. Cybersecurity, Law Firms) to ensure broad targeting. If there are already 2 or more campaigns targeting the same general niche or industry, return "REDUNDANT". Also return "REDUNDANT" if it is too similar to an existing campaign. Return "UNIQUE" only if the proposed campaign targets a new niche that has fewer than 2 existing campaigns in it. Return ONLY "REDUNDANT" or "UNIQUE".' },
                    { role: 'user', content: `Existing Campaigns:\n${existingSummary}\n\nProposed New Campaign:\nName: ${payload.name}\nNiche: ${payload.niche}\nObjective: ${payload.objective}\n\nDecision:` }
                  ]
                });
                
                const decision = similarityResponse.choices[0].message.content.trim().toUpperCase();
                if (decision.includes('REDUNDANT')) {
                  console.log(`[SIMILARITY GUARD] Rejected redundant or niche-capped campaign: "${payload.name}"`);
                  result = { 
                    error: "Redundant or Niche-Capped Campaign", 
                    message: `The proposed campaign "${payload.name}" in niche "${payload.niche || 'unspecified'}" was rejected. We enforce a limit of max 2 campaigns per niche. If 2 campaigns exist for this niche, you are FORBIDDEN from creating a third. Instead, please do one of the following: (1) Choose a different niche (e.g., HVAC, Real Estate, Dental, Logistics, E-Commerce) for a new campaign, or (2) Add fresh leads directly to the existing campaign containers for "${payload.niche}" using their UUIDs.`,
                    existingCampaigns: allCamps.map(c => c.name)
                  };
                  // Set status back to in_progress and return early to messages
                  await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
                  messages.push({ role: "assistant", content: cleanAiText });
                  messages.push({ role: "user", content: `Relay API Result:\n${JSON.stringify(result)}\n\nPlease refine your strategy. Move to a new niche or replenish existing campaigns.` });
                  continue; // Skip the rest of the creation logic
                }
              }

              // 2. Check for duplicate campaign name
              const { data: existing, error: checkError } = await client.from('campaigns')
                .select('id')
                .eq('name', payload.name)
                .eq('user_id', authData.user.id)
                .maybeSingle();
              
              if (existing) {
                result = { error: "Campaign with this name already exists", campaignId: existing.id };
              } else {
                const { data: campaign, error } = await client.from('campaigns').insert({
                  name: payload.name,
                  status: 'draft',
                  user_id: authData.user.id,
                  niche: payload.niche || '',
                  objective: payload.objective || `Target ${payload.niche || 'businesses'} with hyper-personalized outreach`,
                  business_id,
                  target_id
                }).select().single();
                if (error) throw error;

                // AUTO-ASSIGN email accounts to new campaign (filtered by business, distributed evenly)
                try {
                  let acctQuery = client.from('email_accounts')
                    .select('id, email')
                    .eq('user_id', authData.user.id);
                  
                  if (business_id === '0269fe06-4607-4c58-9263-12a3930a1dc3') { // MrMedic
                    acctQuery = acctQuery.like('email', '%mrmedic%');
                  } else { // Relay Solutions
                    acctQuery = acctQuery.like('email', '%relaysolutions%');
                  }

                  const { data: allAccts } = await acctQuery.order('email');
                  if (allAccts && allAccts.length > 0) {
                    const { data: existingAssignments } = await client.from('campaign_email_accounts').select('email_account_id');
                    const counts = {};
                    (existingAssignments || []).forEach(a => { counts[a.email_account_id] = (counts[a.email_account_id] || 0) + 1; });
                    const sorted = [...allAccts].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
                    const picks = sorted.slice(0, Math.min(8, sorted.length));
                    
                    const assignments = picks.map(a => ({ campaign_id: campaign.id, email_account_id: a.id }));
                    const { error: assignErr } = await client.from('campaign_email_accounts').upsert(assignments, { onConflict: 'campaign_id,email_account_id' });
                    
                    if (assignErr) {
                       console.error('[CAMPAIGN EMAIL ASSIGN ERROR]:', assignErr.message);
                    } else {
                       console.log(`[CAMPAIGN] Auto-assigned ${picks.length} email accounts to "${payload.name}"`);
                    }
                  }
                } catch (e) { console.error('[CAMPAIGN EMAIL ASSIGN ERROR]:', e.message); }

                result = campaign;
              }
            }

          } else if (action === 'CREATE_TARGET') {
            const { businessId, name, description } = payload;
            if (!businessId || !name) throw new Error("businessId and name are required for CREATE_TARGET");
            const { data, error } = await client.from('business_targets').insert({
              business_id: businessId,
              name: name,
              description: description || '',
              status: 'active'
            }).select().single();
            if (error) throw error;
            result = data;

          } else if (action === 'UPDATE_CAMPAIGN') {
            const { campaignId, name, niche, objective, status, business_id } = payload;
            if (!campaignId) throw new Error("campaignId is required for UPDATE_CAMPAIGN");
            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (niche !== undefined) updateData.niche = niche;
            if (objective !== undefined) updateData.objective = objective;
            if (status !== undefined) updateData.status = status;
            if (business_id !== undefined) updateData.business_id = business_id;
            const { data, error } = await client.from('campaigns').update(updateData).eq('id', campaignId).select().single();
            if (error) throw error;
            result = data;

          } else if (action === 'DELETE_CAMPAIGN') {
            const { campaignId } = payload;
            if (!campaignId) throw new Error("campaignId is required for DELETE_CAMPAIGN");
            const { error } = await client.from('campaigns').delete().eq('id', campaignId);
            if (error) throw error;
            result = { success: true, message: `Campaign deleted successfully` };

          } else if (action === 'PAUSE_CAMPAIGN') {
            const { campaignId } = payload;
            if (!campaignId) throw new Error("campaignId is required");
            const { data, error } = await client.from('campaigns').update({ status: 'paused' }).eq('id', campaignId).select().single();
            if (error) throw error;
            result = { success: true, message: `Campaign paused`, data };

          } else if (action === 'RESUME_CAMPAIGN') {
            const { campaignId } = payload;
            if (!campaignId) throw new Error("campaignId is required");
            const { data, error } = await client.from('campaigns').update({ status: 'active' }).eq('id', campaignId).select().single();
            if (error) throw error;
            result = { success: true, message: `Campaign resumed`, data };

          } else if (action === 'LIST_CAMPAIGNS') {
            const { data: campaigns, error } = await client.from('campaigns')
              .select('*')
              .eq('user_id', authData.user.id)
              .order('created_at', { ascending: false });
            if (error) throw error;
            result = campaigns;
          } else if (action === 'LIST_LEADS') {
            let query = client.from('leads')
              .select('id, company, website, location, email, validation_status, validation_details')
              .eq('user_id', authData.user.id);
            
            if (payload.campaignId) {
              const { data: cl } = await client.from('campaign_leads').select('lead_id').eq('campaign_id', payload.campaignId);
              const ids = cl?.map(l => l.lead_id) || [];
              query = query.in('id', ids);
            } else if (payload.listId) {
              const { data: ll } = await client.from('list_leads').select('lead_id').eq('list_id', payload.listId);
              const ids = ll?.map(l => l.lead_id) || [];
              query = query.in('id', ids);
            }
            
            const { data: leads, error } = await query.limit(200);
            if (error) throw error;
            result = leads;
          } else if (action === 'GET_LEAD') {
            const { data: lead, error } = await client.from('leads')
              .select('*')
              .eq('id', payload.leadId)
              .single();
            if (error) throw error;
            result = lead;
          } else if (action === 'VALIDATE_LEAD') {
            const fetch = (await import('node-fetch')).default;
            const validationResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/validate-email`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ 
                email: payload.email, 
                leadId: payload.leadId 
              })
            });
            result = await validationResponse.json();
          } else if (action === 'ASSIGN_LEADS' || action === 'ADD_LEADS_TO_CAMPAIGN') {
            // If leadIds are provided, use them. Otherwise use all unmanaged leads.
            let leadIds = payload.leadIds;
            if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
               throw new Error('leadIds array is required for ASSIGN_LEADS. Use LIST_LEADS first to get IDs.');
            }

            const inserts = leadIds.map(id => ({
               campaign_id: payload.campaignId,
               lead_id: id
            }));

            const { error: insertErr } = await client.from('campaign_leads').upsert(inserts, { onConflict: 'campaign_id,lead_id' });
            if (insertErr) throw insertErr;
            
            result = { success: true, addedCount: leadIds.length };
            // Auto-sync campaign prospect count
            const { count: totalLeads } = await client.from('campaign_leads')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', payload.campaignId);
            await client.from('campaigns').update({ prospects: totalLeads || leadIds.length }).eq('id', payload.campaignId);
          } else if (action === 'REMOVE_LEADS_FROM_CAMPAIGN') {
            console.log(`[AGENT] Action REMOVE_LEADS_FROM_CAMPAIGN called but BLOCKED by safety policy.`);
            result = { success: false, message: "CRITICAL: Automated lead removal is FORBIDDEN in production. All leads must be preserved. If you believe a lead is a mismatch, mark it as 'invalid' using a different tool or report it to the Boss. DO NOT attempt to delete leads from campaigns." };
          } else if (action === 'SAVE_LEADS_TO_LIST') {
            const { leads, listName, campaignId } = payload;
            try {
              // Ensure directory exists
              const savedListsDir = path.resolve(__dirname, 'saved_lists');
              if (!fs.existsSync(savedListsDir)) {
                fs.mkdirSync(savedListsDir, { recursive: true });
              }

              // Organize by niche if possible
              const niche = payload.niche || leads[0]?.industry || leads[0]?.niche || 'unassigned';
              const nicheDir = path.join(savedListsDir, niche.replace(/[^a-z0-9]/gi, '_').toLowerCase());
              if (!fs.existsSync(nicheDir)) {
                fs.mkdirSync(nicheDir, { recursive: true });
              }

              const filename = `${(listName || 'General').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.json`;
              const filePath = path.join(nicheDir, filename);
              
              fs.writeFileSync(filePath, JSON.stringify(leads, null, 2));
              console.log(`[Persistence] Saved ${leads.length} leads to local archive: ${filePath}`);

              // Sync to Supabase
              const { data: { user } } = await client.auth.getUser();
              if (user) {
                const { data: list, error: listError } = await client
                  .from('saved_lists')
                  .insert({
                    user_id: user.id,
                    name: listName || 'General',
                    campaign_id: campaignId || null
                  })
                  .select()
                  .single();

                if (!listError && list) {
                  const leadsToInsert = leads.map(l => ({
                    user_id: user.id,
                    email: l.email,
                    name: l.name,
                    company: l.company,
                    title: l.title,
                    website: l.website,
                    industry: l.industry || niche,
                    location: l.location,
                    summary: l.summary,
                    personalized_email: l.personalized_email
                  }));

                  await client.from('leads').upsert(leadsToInsert, { onConflict: 'user_id,website,email', ignoreDuplicates: true });
                  
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

                    // ═══ AUTO-ASSIGN TO CAMPAIGN ═══
                    if (campaignId) {
                      const campaignAssoc = matchedLeads.map(l => ({
                        campaign_id: campaignId,
                        lead_id: l.id
                      }));
                      await client.from('campaign_leads').upsert(campaignAssoc, { onConflict: 'campaign_id,lead_id' });
                      
                      // Update prospect count
                      const { count: totalLeads } = await client.from('campaign_leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('campaign_id', campaignId);
                      await client.from('campaigns').update({ prospects: totalLeads || leads.length }).eq('id', campaignId);
                      console.log(`[Persistence] Linked ${leads.length} leads to Campaign ${campaignId}`);
                    }
                  }
                  console.log(`[Persistence] Synced ${leads.length} leads to Cloud Registry: ${listName}`);
                } else if (listError) {
                  console.error('[Persistence Sync Error]', listError);
                }
              }

              result = { success: true, filename, count: leads.length };
            } catch (error) {
              console.error('[Persistence Error]', error);
              result = { success: false, error: error.message };
            }
          } else if (action === 'GENERATE_SEQUENCE') {
            // ═══ GUARD: Check if templates already exist (cap at 5 per campaign) ═══
            const { data: existingTemplates } = await client.from('templates')
              .select('id, name')
              .eq('campaign_id', payload.campaignId);

            if (existingTemplates && existingTemplates.length >= 5) {
              console.log(`[SEQUENCE GUARD] Campaign ${payload.campaignId} already has ${existingTemplates.length} templates. Skipping generation.`);
              result = { 
                success: false, 
                error: 'SEQUENCE_ALREADY_EXISTS', 
                message: `This campaign already has ${existingTemplates.length} email templates. Do NOT call GENERATE_SEQUENCE again. Proceed to ACTIVATE_SCHEDULE instead.`,
                existingTemplates: existingTemplates.map(t => t.name)
              };
            } else {
              // Generate 5-step email sequence using AI and write to `templates` table
              // Fetch campaign business context
              const { data: campaignData } = await client.from('campaigns').select('business_id').eq('id', payload.campaignId).single();
              const isMrMedic = campaignData && campaignData.business_id === '0269fe06-4607-4c58-9263-12a3930a1dc3';

              const niche = payload.niche || (isMrMedic ? 'Events' : 'Business');
              const company = payload.company || (isMrMedic ? 'MrMedic Events' : 'Relay Solutions');
              const pitch = payload.pitch || (isMrMedic ? 'Qualified clinical event medical cover (paramedics and nurses)' : 'Systems & Automation');
              const contactNumber = payload.contactNumber || (isMrMedic ? '+44 7887 537731' : '+44 786451184');
              const primaryEmail = payload.primaryEmail || (isMrMedic ? 'clara@mrmedicevents.co.uk' : 'ethan@relaysolutions.net');

              // If partially generated (< 5), delete existing and regenerate cleanly
              if (existingTemplates && existingTemplates.length > 0) {
                console.log(`[SEQUENCE CLEANUP] Removing ${existingTemplates.length} partial templates before regeneration.`);
                await client.from('templates').delete().eq('campaign_id', payload.campaignId);
              }

              // Read the campaign brief file from disk dynamically based on parent business ID
              const briefFileName = isMrMedic ? 'MrMedic_ColdEmail_AI_Brief.md' : 'Relay_ColdEmail_AI_Brief.md';
              const briefPath = path.join(__dirname, '../companies', briefFileName);
              let briefContent = '';
              try {
                briefContent = fs.readFileSync(briefPath, 'utf-8');
                console.log(`[GENERATE_SEQUENCE] Dynamically loaded campaign brief from ${briefFileName}`);
              } catch (err) {
                console.error(`[GENERATE_SEQUENCE ERROR] Failed to load brief from ${briefPath}:`, err.message);
              }

              // Build system prompt injecting the exact brief instructions
              const systemPrompt = `You are an elite B2B sales strategist and copywriter.
Below is the campaign brief for the business you are representing:
---
${briefContent}
---

Your task is to generate a high-converting, compliant 5-step cold email sequence.
CRITICAL INSTRUCTIONS:
1. You MUST strictly follow the copywriting constraints, rules, word counts, and forbidden terms defined in the brief above.
2. Identify the segment of the campaign based on the niche/parameters and apply the correct angle/hooks.
3. Return ONLY a valid JSON array containing exactly 5 objects with keys: "name", "subject", "content".
4. Do NOT include markdown styling or outer explanation. Just the raw JSON.`;

              await checkRateLimit();
              const seqResponse = await fetchAIChatCompletion({
                model: MODEL,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Campaign: ${payload.campaignId || 'New Campaign'}\nNiche: ${niche}\nCompany: ${company}\nPitch: ${pitch}\nContact: ${contactNumber}\nEmail: ${primaryEmail}\n\nGenerate the 5-step sequence now. JSON only, no markdown.` }
                ]
              });

              let steps;
              try {
                const raw = seqResponse.choices[0].message.content.trim();
                steps = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));
              } catch (e) {
                throw new Error('AI returned invalid JSON for sequence generation');
              }

              // Cap at exactly 5 steps
              if (steps.length > 5) steps = steps.slice(0, 5);

              const createdTemplates = [];
              for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                // DO NOT append signature here — process-campaign edge function handles sign-offs
                // This eliminates the double sign-off bug
                const { data: tmpl, error: tmplErr } = await client.from('templates').insert({
                  campaign_id: payload.campaignId,
                  name: step.name || `Step ${i + 1}`,
                  subject: step.subject,
                  content: step.content || '',
                  step_number: i + 1
                }).select().single();
                if (tmplErr) console.error(`[TEMPLATE INSERT ERROR step ${i+1}]:`, tmplErr);
                else createdTemplates.push(tmpl);
              }

              // Also store in campaign_sequences for legacy compatibility
              await client.from('campaign_sequences').insert({
                campaign_id: payload.campaignId,
                subject: steps[0]?.subject || 'Outreach Sequence',
                step_1: steps[0]?.content || '',
                step_2: steps[1]?.content || '',
                step_3: steps[2]?.content || '',
                user_id: authData.user.id
              });

              result = { success: true, templatesCreated: createdTemplates.length, templates: createdTemplates };
            }
          } else if (action === 'ACTIVATE_SCHEDULE') {
            // ═══ GUARD: Check if schedules already exist for this campaign ═══
            const { data: existingSchedules } = await client.from('scheduled_emails')
              .select('id, template_id, status')
              .eq('campaign_id', payload.campaignId);

            if (existingSchedules && existingSchedules.length > 0) {
              const activeCount = existingSchedules.filter(s => s.status === 'scheduled').length;
              console.log(`[SCHEDULE GUARD] Campaign ${payload.campaignId} already has ${existingSchedules.length} schedules (${activeCount} active).`);
              
              // Ensure campaign is set to in_progress even if schedules already exist
              await client.from('campaigns').update({ status: 'in_progress' }).eq('id', payload.campaignId);
              
              result = { 
                success: true, 
                message: `Schedule already active. ${existingSchedules.length} steps scheduled (${activeCount} pending). Campaign is in_progress. Do NOT call ACTIVATE_SCHEDULE again.`,
                existingSchedules: existingSchedules.length
              };
            } else {
              // One scheduled_emails entry PER TEMPLATE (Step), matching the process-campaign function logic.
              const { data: templates } = await client.from('templates')
                .select('*')
                .eq('campaign_id', payload.campaignId)
                .order('step_number', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true });

              const { data: campaignLeads } = await client.from('campaign_leads')
                .select('lead_id')
                .eq('campaign_id', payload.campaignId);

              let emailAccts;
              const { data: emailAcctsData } = await client.from('campaign_email_accounts')
                .select('email_account_id')
                .eq('campaign_id', payload.campaignId);
              emailAccts = emailAcctsData;

              if (!templates || templates.length === 0) throw new Error('No templates found for this campaign. Run GENERATE_SEQUENCE first.');
              if (!campaignLeads || campaignLeads.length === 0) throw new Error('No leads assigned to this campaign. Run ASSIGN_LEADS first.');
              
              // AUTO-ASSIGN email accounts if missing
              if (!emailAccts || emailAccts.length === 0) {
                console.log(`[ACTIVATE] Campaign ${payload.campaignId} has no email accounts. Attempting auto-assignment...`);
                const { data: allAccts } = await client.from('email_accounts').select('id').eq('user_id', authData.user.id);
                if (allAccts && allAccts.length > 0) {
                   const picks = allAccts.slice(0, 8);
                   await client.from('campaign_email_accounts').upsert(picks.map(a => ({ campaign_id: payload.campaignId, email_account_id: a.id })));
                   const { data: refreshed } = await client.from('campaign_email_accounts').select('email_account_id').eq('campaign_id', payload.campaignId);
                   emailAccts = refreshed;
                }
              }

              if (!emailAccts || emailAccts.length === 0) throw new Error('No email accounts assigned and auto-assignment failed. Run ASSIGN_EMAIL_ACCOUNTS first.');

              const now = new Date();
              const acctIds = emailAccts.map(e => e.email_account_id);
              const totalSteps = Math.min(templates.length, 5); // Cap at 5 steps
              
              for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
                const template = templates[stepIdx];
                const stepDate = new Date(now.getTime() + (stepIdx * 1 * 24 * 60 * 60 * 1000)); // 1-day intervals

                // Upsert to prevent duplicates (unique constraint: campaign_id + template_id)
                const { data: scheduleData, error: schedErr } = await client.from('scheduled_emails').upsert({
                  campaign_id: payload.campaignId,
                  template_id: template.id,
                  scheduled_for: stepDate.toISOString(),
                  status: 'scheduled',
                  total_emails: campaignLeads.length,
                  sent_emails: 0,
                  interval_minutes: 15,
                  emails_per_account: payload.maxEmailsPerDay || 50,
                  start_date: stepDate.toISOString(),
                  end_date: new Date(stepDate.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString()
                }, { onConflict: 'campaign_id,template_id' }).select().single();

                if (schedErr) throw schedErr;

                // Link ALL campaign email accounts to this schedule (upsert to prevent duplicates)
                const accountLinks = acctIds.map(accId => ({
                  schedule_id: scheduleData.id,
                  email_account_id: accId,
                  emails_sent: 0,
                  emails_remaining: payload.maxEmailsPerDay || 50
                }));

                await client.from('schedule_email_accounts').upsert(accountLinks, { onConflict: 'schedule_id,email_account_id' });

                const progress = Math.min(Math.round(((stepIdx + 1) / totalSteps) * 100), 100);
                await supabase.from('tasks').update({ progress }).eq('id', task.id);
              }

              // Activate the campaign itself
              await client.from('campaigns').update({ status: 'in_progress' }).eq('id', payload.campaignId);
              result = { success: true, stepsScheduled: totalSteps, leadsPerStep: campaignLeads.length, accountsLinked: acctIds.length };
            }
          } else if (action === 'SET_OBJECTIVE') {
            const { error } = await client.from('campaigns').update({ objective: payload.objective }).eq('id', payload.campaignId);
            if (error) throw error;
            result = { success: true, campaignId: payload.campaignId };
          } else if (action === 'UPDATE_PROSPECTS') {
            const { count, error: countErr } = await client.from('campaign_leads')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', payload.campaignId);
            if (countErr) throw countErr;
            await client.from('campaigns').update({ prospects: count || 0 }).eq('id', payload.campaignId);
            result = { success: true, prospects: count };
          } else if (action === 'ASSIGN_EMAIL_ACCOUNTS') {
            // Assign 8 email accounts to a campaign (distributed evenly)
            const { data: allAccts } = await client.from('email_accounts')
              .select('id, email')
              .eq('user_id', authData.user.id)
              .order('email');
            
            if (!allAccts || allAccts.length === 0) throw new Error('No email accounts found');

            // Get current assignments to distribute evenly
            const { data: existingAssignments } = await client.from('campaign_email_accounts').select('email_account_id');
            const assignmentCounts = {};
            (existingAssignments || []).forEach(a => {
              assignmentCounts[a.email_account_id] = (assignmentCounts[a.email_account_id] || 0) + 1;
            });

            // Sort accounts by fewest existing assignments (distribute evenly)
            const sorted = [...allAccts].sort((a, b) => (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0));
            const toAssign = sorted.slice(0, Math.min(8, sorted.length));

            const inserts = toAssign.map(acct => ({
              campaign_id: payload.campaignId,
              email_account_id: acct.id
            }));

            await client.from('campaign_email_accounts').upsert(inserts, { onConflict: 'campaign_id,email_account_id' });
            result = { success: true, assigned: toAssign.map(a => a.email), count: toAssign.length };
          } else if (action === 'UPDATE_BUSINESS_TIMELINE') {
            if (task.assigned_to !== 'Boss') {
               throw new Error('CRITICAL ERROR: Only the Boss can update the business timeline.');
            }
            const { businessId, tasks } = payload;
            if (!businessId || !tasks || !Array.isArray(tasks)) {
               throw new Error('businessId and tasks array are required');
            }
            // Wipe existing tasks and insert new ones
            await client.from('business_tasks').delete().eq('business_id', businessId);
            const inserts = tasks.map(t => ({
               business_id: businessId,
               step_number: t.step || 0,
               description: t.desc || '',
               status: t.status || 'pending'
            }));
            const { error: insertErr } = await client.from('business_tasks').insert(inserts);
            if (insertErr) throw insertErr;
            result = { success: true, message: `Replaced timeline with ${inserts.length} tasks for business ${businessId}` };
          } else {
            throw new Error("Unknown action: " + action);
          }
          await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
          
          messages.push({ role: "assistant", content: cleanAiText });
          messages.push({ role: "user", content: `Relay API Result:\n${JSON.stringify(result)}\n\nThe job has been successfully requested on the Relay backend. Proceed with the next steps.` });
        } catch (e) {
          await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
          messages.push({ role: "assistant", content: cleanAiText });
          messages.push({ role: "user", content: `Relay API failed: ${e.message}` });
        }
      } else if (delegateMatch) {
        // Strip markdown formatting and resolve to a valid agent name
        const delegateAgent = resolveAgentName(delegateMatch[1]);
        const delegateTask = delegateMatch[2].trim();
        
        console.log(`[DELEGATING] ${task.assigned_to} -> ${delegateAgent}: ${delegateTask}`);
        
        let summary = delegateTask.substring(0, 100) + "...";
        try {
          const summaryRes = await fetchAIChatCompletion({
            model: MODEL,
            messages: [{ role: "system", content: "Summarize this task into a single, punchy 5-10 word action-oriented sentence for a UI dashboard. DO NOT use markdown. Start with a verb." }, { role: "user", content: delegateTask.substring(0, 2000).toWellFormed() }]
          });
          summary = summaryRes.choices[0].message.content.trim();
        } catch (e) { console.error("Summary error:", e); }
        
        const descriptionWithSummary = `[SUMMARY: ${summary}]\n\n${delegateTask}`;
        
        // Create new task for the delegated agent
        await supabase.from('tasks').insert([{ assigned_to: delegateAgent, description: descriptionWithSummary, status: 'pending' }]);
        await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `<thought>Delegating to ${delegateAgent}</thought> I have delegated a task to ${delegateAgent}: ${summary}` }]);
        delegatedDuringTask = true;
        
        // Save the delegation result so Boss report-back has context
        const delegationResult = `Delegated to ${delegateAgent}: ${summary}`;
        await supabase.from('tasks').update({ result: delegationResult }).eq('id', task.id);
        task.result = delegationResult;
        
        // IMMEDIATELY finish the loop — delegation is done, no need for another AI call
        // The Boss will be notified via the report-back mechanism after the loop ends
        isFinished = true;
        console.log(`[DELEGATION COMPLETE] ${task.assigned_to} → ${delegateAgent}. Breaking loop.`);
      } else {
        // No tool calls, finish
        await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: aiText }]);
        // Save the final response for downstream pipeline agents
        const cleanResult = aiText.replace(/<(thought|think)>[\s\S]*?<\/(thought|think)>/gi, '').substring(0, 5000).toWellFormed();
        await supabase.from('tasks').update({ result: cleanResult }).eq('id', task.id);
        task.result = cleanResult;
        isFinished = true;
      }
    }

    // Mark task completed (Shows Grey Dot on UI)
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id);
    console.log(`[TASK COMPLETED] ID: ${task.id}`);

    // ═══ ASSEMBLY LINE: ALWAYS REPORT BACK TO BOSS ═══
    // Every agent (except Boss) reports back to Boss after completing their task.
    // This keeps the loop alive — Boss is the orchestrator and must always know what happened.
    const cleanAssignedTo = resolveAgentName(task.assigned_to);
    
    // Extract campaign UUIDs from the task description for context continuity
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const foundUuids = [...new Set(task.description.match(uuidPattern) || [])];
    const campaignCtx = foundUuids.length > 0 ? `\nCampaign IDs referenced: ${foundUuids.join(', ')}` : '';
    const prevResult = (task.result || 'Completed without detailed output.').substring(0, 3000).toWellFormed();

    // ALWAYS report back to Boss (unless this IS the Boss)
    // This is the core loop mechanism — Boss must be notified after every agent finishes
    if (cleanAssignedTo !== 'Boss') {
      // Fetch LIVE campaign snapshot so Boss has real data
      let liveCampaignSnapshot = 'Unable to fetch campaigns.';
      try {
        const { data: bossAuth } = await supabase.auth.signInWithPassword({
          email: 'ptnmgmt@gmail.com', password: 'Longlonglong1!'
        });
        if (bossAuth?.session) {
          const bossClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${bossAuth.session.access_token}` } }
          });
          const { data: camps } = await bossClient.from('campaigns')
            .select('id, name, status, niche, prospects, objective, business_id, businesses(id, status)')
            .eq('user_id', bossAuth.user.id)
            .order('created_at', { ascending: false });
          if (camps && camps.length > 0) {
            const { data: allScheds } = await bossClient.from('scheduled_emails').select('campaign_id, scheduled_for, sent_emails, total_emails, status');
            const now = new Date();
            const activeCount = camps.filter(c => {
              if (c.businesses && c.businesses.status === 'inactive') return false;
              if (c.status?.toLowerCase() === 'completed') return false;
              const myScheds = (allScheds || []).filter(s => s.campaign_id === c.id);
              if (myScheds.length === 0) return true;
              return myScheds.some(s => new Date(s.scheduled_for) <= now && (s.sent_emails || 0) < (s.total_emails || 0) && s.status === 'scheduled');
            }).length;

            liveCampaignSnapshot = camps.filter(c => c.businesses?.status !== 'inactive').map(c => {
              const bizLabel = c.businesses?.status === 'inactive' ? ' (DISABLED)' : '';
              return `| ${c.name}${bizLabel} | ${c.status} | ${c.niche || 'N/A'} | ${c.prospects || 0} | ${c.id} |`;
            }).join('\n');
            liveCampaignSnapshot = `| Name | Status | Niche | Leads | Campaign ID (UUID) |\n|------|--------|-------|-------|--------------------|\n${liveCampaignSnapshot}\n\n**Active: ${activeCount}/5 campaigns** (Total: ${camps.length})`;
          } else {
            liveCampaignSnapshot = '⚠️ **NO CAMPAIGNS EXIST.** You MUST call RELAY_API: CREATE_CAMPAIGN first before anything else.';
          }
        }
      } catch(e) { console.error('[BOSS SNAPSHOT ERROR]:', e.message); }

      // Pipeline-aware recommendations for the Boss
      const nextStepMap = {
        'Market Researcher': `**RECOMMENDED NEXT STEP:** Check the LIVE CAMPAIGN DASHBOARD below. If campaigns exist with the researched niche, DELEGATE to **Scraper** with the real campaign UUID. If NO campaigns exist, call RELAY_API: CREATE_CAMPAIGN first, then delegate to Scraper.`,
        'Scraper': `**RECOMMENDED NEXT STEP:** Check the LIVE CAMPAIGN DASHBOARD below. If campaigns show prospects > 0, DELEGATE to **Validator**. If prospects are still 0, the scrape may still be processing — wait or retry.`,
        'Validator': `**RECOMMENDED NEXT STEP:** Check the LIVE CAMPAIGN DASHBOARD below. Only DELEGATE to **Sales Strategist** for campaigns that have prospects > 0. The Strategist needs real campaign UUIDs from the dashboard.`,
        'Sales Strategist': `**RECOMMENDED NEXT STEP:** Check the LIVE CAMPAIGN DASHBOARD below. Only DELEGATE to **Emailer** for campaigns that have prospects > 0 AND already have sequences generated.`,
        'Emailer': `**🎉 PIPELINE COMPLETE!** Check the LIVE CAMPAIGN DASHBOARD below. If all campaigns are active, find a NEW niche and DELEGATE to **Market Researcher** for the next round.`
      };
      const nextStep = nextStepMap[cleanAssignedTo] || `Review the output and the LIVE CAMPAIGN DASHBOARD below to decide the next action.`;
      
      const bossReportDesc = `[SUMMARY: ${cleanAssignedTo} reporting in — task complete]

### 📋 AGENT STATUS REPORT: ${cleanAssignedTo}
**Status:** ✅ Task completed${delegatedDuringTask ? ' (also delegated downstream)' : ''}
**Agent:** ${cleanAssignedTo}
${campaignCtx}

### AGENT OUTPUT:
${prevResult}

### ${nextStep}

### 📊 LIVE CAMPAIGN DASHBOARD:
${liveCampaignSnapshot}

### YOUR ORDERS, BOSS:
You are the Boss of the Openclaw Factory Assembly Line. An agent has just reported in after completing their task.

**Your job now:**
1. **READ THE LIVE CAMPAIGN DASHBOARD ABOVE** — use ONLY the real UUIDs shown there.
2. **MONITOR CURRENT CAMPAIGNS**: If any campaign is active but its Leads count is 0 or stalled, your IMMEDIATE priority is to DELEGATE to **Scraper** to replenish leads for that specific campaign. Do not leave campaigns with 0 leads.
3. **MAINTAIN 3-5 TARGETS & CAMPAIGNS**: Only if existing campaigns are healthy (prospects > 0 and progressing), should you create new ones. If there are fewer than 3 active targets in LIVE METRICS, use \`RELAY_API: CREATE_TARGET\`. CRITICAL: Target names MUST be action-oriented goals. If fewer than 3 active campaigns in the dashboard, use \`RELAY_API: CREATE_CAMPAIGN\`. Maximum of 5 active for each.
4. If campaigns have prospects > 0 → Follow the RECOMMENDED NEXT STEP above.
5. **NEVER invent campaign IDs.** Only use UUIDs from the dashboard.

**CRITICAL: Do NOT idle. Do NOT just acknowledge. TAKE ACTION — use real data from the dashboard above.**`;

      await supabase.from('tasks').insert([{ assigned_to: 'Boss', description: bossReportDesc, status: 'pending' }]);
      await supabase.from('chat_logs').insert([{ agent_name: 'System', message: `📡 ${cleanAssignedTo} reporting back to Boss — task complete` }]);
      console.log(`[REPORT TO BOSS] ${cleanAssignedTo} → Boss (status report)`);
    }

  } catch (error) {
    console.error(`[TASK ERROR]:`, error);
    // Mark Error (Shows Red Dot on UI)
    await supabase.from('tasks').update({ status: 'error' }).eq('id', task.id);
    await supabase.from('chat_logs').insert([{ agent_name: task.assigned_to, message: `System Error: ${error.message}` }]);
  }
}

// 5. Main Orchestrator Polling
let bossLastRun = 0;
const BOSS_INTERVAL = 30000; // 30 seconds for development responsiveness

async function startOrchestrator() {
  console.log("Starting Openclaw Factory Agent Engine...");
  
  // Reset any tasks left in 'in_progress' status from previous crashed runs to 'pending'
  try {
    const { error: resetError } = await supabase
      .from('tasks')
      .update({ status: 'pending' })
      .eq('status', 'in_progress');
    if (resetError) {
      console.error("[ORCHESTRATOR] Failed to reset stale in_progress tasks:", resetError);
    } else {
      console.log("[ORCHESTRATOR] Stale 'in_progress' tasks reset to 'pending' successfully.");
    }
  } catch (err) {
    console.error("[ORCHESTRATOR] Error resetting stale tasks:", err);
  }

  console.log("Listening for new tasks in Supabase...");
  
  let activeTasksCount = 0;
  const MAX_PARALLEL_TASKS = 3;

  async function poll() {
    if (activeTasksCount >= MAX_PARALLEL_TASKS) {
      setTimeout(poll, 3000);
      return;
    }

    try {
      // Auto-clear tasks older than 15 minutes to prevent backlog stalls
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await supabase
        .from('tasks')
        .update({ status: 'canceled' })
        .eq('status', 'pending')
        .lt('created_at', fifteenMinsAgo);

      // Find pending tasks, up to our parallel limit
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(MAX_PARALLEL_TASKS - activeTasksCount);
      
      if (data && data.length > 0) {
        data.forEach(task => {
          activeTasksCount++;
          processTask(task).finally(() => {
            activeTasksCount--;
          });
        });
      } else {
        // Check if there are any in_progress tasks before claiming idle
        const { count, error: countError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_progress');

        if (!countError && count === 0) {
          // Check if there are any tasks in the table at all (to detect manual clear/wipe)
          // Exclude __TASKLIST__ rows — they are internal timeline data, not agent tasks
          const { count: totalTasksCount, error: totalCountError } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .not('assigned_to', 'like', '__TASKLIST__%');

          const isTableCleared = (!totalCountError && totalTasksCount === 0);

          // If idle, let the Boss check in
          const now = Date.now();
          if (isTableCleared || (now - bossLastRun > BOSS_INTERVAL)) {
            
            // ═══ DUPLICATE BOSS GUARD ═══
            // Prevent creating a second Boss task if one is already pending or in progress
            const { count: existingBossTasks } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('assigned_to', 'Boss')
              .in('status', ['pending', 'in_progress']);
            
            if (existingBossTasks && existingBossTasks > 0) {
              console.log("[BOSS GUARD] Boss task already exists. Skipping duplicate creation.");
              setTimeout(poll, 3000);
              return;
            }
            
            bossLastRun = now;
            if (isTableCleared) {
              console.log("[CLEARED] Tasks table is completely empty. Alerting the Boss immediately...");
              try {
                await supabase.from('chat_logs').insert([{ agent_name: 'System', message: '🚨 Factory tasks cleared. Alerting the Boss...' }]);
              } catch (logErr) {
                console.error("[CLEARED LOG ERROR]:", logErr.message);
              }
            } else {
              console.log("[IDLE] No pending or in-progress tasks. Boss is taking the initiative...");
            }
            
            let businessPlan = "Drive growth for LashGlaze.";
            try {
              const fs = require('fs');
              const path = require('path');
              // Read business plan from root
              businessPlan = fs.readFileSync(path.join(__dirname, '../business_plan.md'), 'utf-8');
            } catch (e) {
              // fallback if file not found
            }

            // Fetch recent chat logs to give the Boss context of what was just done
            const { data: logs } = await supabase
              .from('chat_logs')
              .select('agent_name, message')
              .order('created_at', { ascending: false })
              .limit(15);

            const recentContext = logs && logs.length > 0 
              ? logs.reverse().map(l => `[${l.agent_name}]: ${l.message.replace(/<thought>[\s\S]*?<\/thought>/g, '').substring(0, 500).toWellFormed().trim()}`).join('\n')
              : "No recent activity.";

            // Fetch recently finished tasks (completed or error) to maintain situational awareness
            const { data: completedTasks } = await supabase
              .from('tasks')
              .select('description, assigned_to, result, status')
              .in('status', ['completed', 'error'])
              .neq('assigned_to', 'Boss') 
              .order('created_at', { ascending: false })
              .limit(10);

            const completedContext = completedTasks && completedTasks.length > 0
              ? completedTasks.map(t => `- [${t.assigned_to}]: ${t.description.substring(0, 200).toWellFormed().trim()} [${t.status.toUpperCase()}] (Result: ${(t.result || 'No output').substring(0, 300).toWellFormed()})`).join('\n')
              : "No tasks finished yet.";

            // Fetch current campaign dashboard for strategic decision-making
            const { data: authForBoss } = await supabase.auth.signInWithPassword({
              email: 'ptnmgmt@gmail.com', password: 'Longlonglong1!'
            });
            let campaignDashboard = 'Unable to fetch campaigns.';
            let businessContext = 'PTN Relay Solutions';
            let activeBusinessId = null;
            let timelineContext = 'NO TIMELINE EXISTS. You MUST call RELAY_API: CREATE_TASKLIST to generate a 10-step strategic plan.';
            
            if (authForBoss?.session) {
              const bossClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${authForBoss.session.access_token}` } }
              });
              
              // Fetch active businesses
              const { data: activeBusinesses } = await bossClient.from('businesses').select('*').eq('status', 'active');
              if (activeBusinesses && activeBusinesses.length > 0) {
                businessContext = activeBusinesses.map(b => b.name).join(' and ');
                activeBusinessId = activeBusinesses[0].id;
              }

              // Fetch Global Timeline for active business
              if (activeBusinessId) {
                const { data: tlData } = await bossClient.from('tasks').select('*').eq('assigned_to', `__TASKLIST__${activeBusinessId}`).maybeSingle();
                if (tlData && tlData.description) {
                  try {
                    const parsed = JSON.parse(tlData.description);
                    timelineContext = "CURRENT TIMELINE:\\n" + parsed.map(t => `Step ${t.step_number}: [${t.status.toUpperCase()}] ${t.description}`).join('\\n');
                  } catch(e) {
                    timelineContext = tlData.description;
                  }
                }
              }

              const { data: camps } = await bossClient.from('campaigns')
                .select('id, name, status, niche, prospects, objective, business_id, businesses(id, status)')
                .eq('user_id', authForBoss.user.id)
                .order('created_at', { ascending: false });
              if (camps && camps.length > 0) {
                const { data: allScheds } = await bossClient.from('scheduled_emails')
                  .select('campaign_id, scheduled_for, sent_emails, total_emails, status, created_at')
                  .order('created_at', { ascending: true });
                const now = new Date();
                const activeCount = camps.filter(c => {
                  if (c.businesses && c.businesses.status === 'inactive') return false;
                  if (c.status?.toLowerCase() === 'completed') return false;
                  const myScheds = (allScheds || []).filter(s => s.campaign_id === c.id);
                  if (myScheds.length === 0) return true;
                  return myScheds.some(s => new Date(s.scheduled_for) <= now && (s.sent_emails || 0) < (s.total_emails || 0) && s.status === 'scheduled');
                }).length;

                campaignDashboard = camps.filter(c => c.businesses?.status !== 'inactive').map(c => {
                  const myScheds = (allScheds || []).filter(s => s.campaign_id === c.id);
                  const progressText = myScheds.map((s, idx) => `Step ${idx + 1}: ${s.sent_emails || 0}/${s.total_emails || 0} [${s.status}]`).join(', ') || 'No email steps generated yet.';
                  const bizLabel = c.businesses?.status === 'inactive' ? ' (DISABLED)' : ` (Biz: ${c.businesses?.name || 'Unknown'})`;
                  return `- **${c.name}**${bizLabel} [${c.status}] | Niche: ${c.niche || 'N/A'} | Prospects: ${c.prospects || 0} | Progress: ${progressText} | Objective: ${c.objective || '⚠️ NOT SET — USE SET_OBJECTIVE!'} | ID: ${c.id}`;
                }).join('\\n');
                campaignDashboard += `\\n\\n**ACTIVE CAMPAIGNS: ${activeCount}/5** (Total: ${camps.length})`;
              } else {
                campaignDashboard = '⚠️ **NO CAMPAIGNS EXIST.** You MUST call RELAY_API: CREATE_CAMPAIGN | {"name": "...", "niche": "..."} to create the first campaign before delegating to any agent.';
              }
            }

            const { error: insertError } = await supabase.from('tasks').insert([{
              assigned_to: 'Boss',
              description: `[SUMMARY: Boss reviewing the Global Timeline and directing the Assembly Line]

You are the Boss of Openclaw Factory. The factory is idle. Your mission is to scale **${businessContext}**.
Your active Business ID is: **${activeBusinessId}**

### 🚨 CRITICAL RULE — GLOBAL BUSINESS TIMELINE
You are in charge of a sequential 10-step Timeline that represents the overarching business goal (e.g. "Get calendar bookings").
Instead of running a messy web of parallel tasks, you strictly follow the timeline.
Agents will execute the granular work you delegate to them, but YOU update the timeline.

${timelineContext}

### YOUR IMMEDIATE ACTIONS:
1. **CHECK THE TIMELINE ABOVE.**
2. **If NO TIMELINE EXISTS**: You MUST call \`RELAY_API: CREATE_TASKLIST | {"businessId": "${activeBusinessId}", "steps": ["Identify pain points for target niche", "Scrape leads", "Draft sequence to get calendar bookings", "Launch campaign"]}\` to generate a 5-10 step strategic plan. **CRITICAL:** Ensure your steps reflect ACTUAL business targets (e.g., getting calendar bookings, closing Web Dev/Renovation clients, addressing specific pain points from the Business Plan). Do not just make generic campaign targets.
3. **If a TIMELINE EXISTS**: Review the current \`pending\` or \`in_progress\` step.
   - Look at the RECENTLY COMPLETED logs. Did the agent finish the granular work for this step?
   - If YES → Call \`RELAY_API: UPDATE_TASKLIST_STEP | {"businessId": "${activeBusinessId}", "stepNumber": <number>, "status": "completed"}\` to mark it done, and then immediately DELEGATE the NEXT step to the appropriate agent.
   - If NO → DELEGATE the granular task for the current step to the appropriate agent (e.g. \`DELEGATE: Market Researcher | Find 5 targets for the campaign...\`).
4. **MAINTAIN 3-5 TARGETS & CAMPAIGNS**: Remember you still use \`RELAY_API: CREATE_TARGET\` and \`RELAY_API: CREATE_CAMPAIGN\` to perform the underlying work of those timeline steps! If you see fewer than 3 active targets in LIVE METRICS, you MUST call \`RELAY_API: CREATE_TARGET\`. CRITICAL: Target names MUST be action-oriented goals (e.g., "Get bookings for AI Automation", "Find clients for Website Renovation"). Do NOT use simple niches or generic nouns (like "UK SaaS" or "Dental Practices"). If you see fewer than 3 active campaigns, you MUST call \`RELAY_API: CREATE_CAMPAIGN\`. Max 5 of each.

--- CAMPAIGN DASHBOARD ---
${campaignDashboard}

--- RECENT ACTIVITY ---
${recentContext}

--- RECENTLY COMPLETED ---
${completedContext}

--- BUSINESS PLAN ---
${businessPlan}

Act now. Follow the sequential Timeline.`,
              status: 'pending'
            }]);
            
            if (insertError) {
              console.error("[BOSS INSERT ERROR]:", insertError);
            } else {
              console.log("[BOSS TASK CREATED] Waiting for worker to pick it up...");
            }
          }
        }
      }
    } catch (err) {
      console.error("[POLLER ERROR]:", err);
    }
    setTimeout(poll, 3000); // Check again in 3 seconds
  }
  
  poll();
}

// 6. BullMQ Worker implementation (if redis is available)
if (redisConnection) {
  const worker = new Worker('agentTasks', async job => {
    await processTask(job.data);
  }, { connection: redisConnection });
}

// 7. WhatsApp Integration
const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

whatsappClient.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log('\\n=========================================');
    console.log('[WHATSAPP] Scan the QR code above to connect OpenClaw to WhatsApp!');
    console.log('=========================================\\n');
});

whatsappClient.on('ready', () => {
    console.log('[WHATSAPP] Client is ready! OpenClaw is now connected to your WhatsApp.');
    global.whatsappClientReady = true;
    global.whatsappClient = whatsappClient;
});

whatsappClient.on('message', async msg => {
    console.log(`[WHATSAPP MESSAGE] ${msg.from}: ${msg.body}`);
    
    // Check if there is a task waiting for reply
    const { data: waitingTask } = await supabase.from('tasks').select('*').eq('status', 'waiting_for_reply').limit(1).single();
    
    if (waitingTask) {
        // Resume the task
        await supabase.from('tasks').update({ 
            status: 'pending', 
            description: waitingTask.description + "\n\nUSER REPLY: " + msg.body 
        }).eq('id', waitingTask.id);
        
        // Log the reply to the chat terminal
        await supabase.from('chat_logs').insert([{ 
            agent_name: 'User', 
            message: `[WhatsApp Reply]: ${msg.body}` 
        }]);
        
        console.log("[WHATSAPP] Resumed waiting task", waitingTask.id);
    } else {
        // Log the incoming message to the chat terminal
        await supabase.from('chat_logs').insert([{ 
            agent_name: 'User', 
            message: `[WhatsApp Incoming]: ${msg.body}` 
        }]);

        // Queue new task from Boss
        if (agentQueue) {
            await agentQueue.add('whatsapp_task', {
                id: 'wa_' + Date.now(),
                assigned_to: 'Boss',
                description: `Message from WhatsApp User: ${msg.body}`,
                status: 'pending'
            });
        } else {
            await supabase.from('tasks').insert([{
                assigned_to: 'Boss',
                description: `WhatsApp: ${msg.body}`,
                status: 'in_progress'
            }]);
        }
    }
});

// 8. Initialization
async function initialize() {
    try {
        console.log("[WHATSAPP] Initializing WhatsApp Client...");
        
        // Anti-lock logic: Clear SingletonLock and journal files to prevent "resource busy" errors
        const fs = require('fs');
        const authDir = path.join(__dirname, '.wwebjs_auth');
        
        const cleanupLocks = (dir) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    cleanupLocks(fullPath);
                } else if (file.includes('SingletonLock') || file.endsWith('.db-journal') || file.includes('lockfile')) {
                    try {
                        fs.unlinkSync(fullPath);
                        console.log(`[WHATSAPP] Cleared stale lock/journal: ${file}`);
                    } catch (e) {
                        // File might be in use, which is expected if another instance is actually running
                    }
                }
            }
        };

        if (fs.existsSync(authDir)) {
            cleanupLocks(authDir);
        }

        // Start WhatsApp initialization in the background, do not await so we don't block the engine
        whatsappClient.initialize().catch(err => {
            console.error("[WHATSAPP ERROR] Failed to initialize WhatsApp:", err.message);
            console.log("[WHATSAPP] Continuing without WhatsApp integration...");
        });
    } catch (err) {
        console.error("[WHATSAPP SYNC ERROR]", err.message);
    }
    
    // Always start the orchestrator, even if WhatsApp fails
    startOrchestrator();
}

initialize();
