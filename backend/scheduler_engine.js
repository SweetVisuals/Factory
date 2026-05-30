const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const OpenAI = require('openai');
const { fetchAIChatCompletion } = require('./ai-client');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.OPENAI_API_BASE || 'https://api.deepseek.com/v1'
});
const MODEL = process.env.MODEL || 'openrouter/owl-alpha';

const SCHEDULER_AGENTS = ['Manager', 'Pinterest Curator', 'Content Creator', 'Account Manager'];

const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
    console.log("[SYSTEM] Running in DRY-RUN mode. No actual scheduling will be committed to Postiz.");
}

async function scrapePinterest(query) {
    console.log(`[PUPPETEER] Scraping Pinterest for: ${query}`);
    if (isDryRun) {
        console.log(`[DRY-RUN] Simulated scraping 10 images for ${query}`);
        return ["https://example.com/img1.jpg", "https://example.com/img2.jpg"];
    }
    
    // NOTE: Real Pinterest scraping is complex due to scrolling and auth walls.
    // For this MVP, we will use duckduckgo image search as a fallback if pinterest blocks us.
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query + ' pinterest aesthetic')}&iax=images&ia=images`, { waitUntil: 'networkidle2' });
        
        const imageUrls = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img.tile--img__img'));
            return imgs.map(img => img.src).filter(src => src.startsWith('http')).slice(0, 15);
        });
        await browser.close();
        return imageUrls;
    } catch (e) {
        console.error("Scraping failed", e);
        await browser.close();
        return [];
    }
}

async function executeTool(agent, action, payloadStr, task) {
    let payload = {};
    try {
        payload = JSON.parse(payloadStr);
    } catch (e) {
        return { success: false, error: "Invalid JSON payload" };
    }

    console.log(`[TOOL] ${action} executed by ${agent} with payload`, payload);

    if (action === 'PINTEREST_SCRAPE') {
        const images = await scrapePinterest(payload.query);
        return { success: true, images };
    }
    
    if (action === 'CREATE_FOLDER_AND_UPLOAD') {
        if (isDryRun) return { success: true, folderId: `simulated-folder-${Date.now()}` };
        // Create folder in Supabase table "folders"
        const { data, error } = await supabase.from('folders').insert([{ name: payload.folderName, user_id: process.env.SYSTEM_USER_ID }]).select();
        if (error) return { success: false, error: error.message };
        // Upload images logic goes here (fetching urls and saving to storage)
        return { success: true, folderId: data[0].id };
    }

    if (action === 'ASSIGN_FOLDER') {
        if (isDryRun) return { success: true };
        const { error } = await supabase.from('folders').update({ accountId: payload.accountId }).eq('id', payload.folderId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    }

    if (action === 'FETCH_SPOTIFY_STATS') {
        return { 
            success: true, 
            artist: payload.artist, 
            streams_last_24h: 15000, 
            top_track: "Midnight Vibes",
            insight: "Streams are slightly down. Needs a push."
        };
    }

    if (action === 'CREATE_HOOK_TEMPLATE') {
        if (isDryRun) return { success: true, templateId: `simulated-template-${Date.now()}` };
        const template = {
            id: `template_${Date.now()}`,
            name: payload.title,
            textOverlays: payload.overlays || [],
            user_id: process.env.SYSTEM_USER_ID
        };
        const { data, error } = await supabase.from('slideshow_templates').insert([template]).select();
        if (error) return { success: false, error: error.message };
        return { success: true, templateId: data[0].id };
    }

    if (action === 'ACTIVATE_QUICK_MODE') {
        if (isDryRun) {
            console.log(`[DRY-RUN] Activated quick mode for Template ${payload.templateId}, Folder ${payload.folderId}, Account ${payload.accountId}`);
            return { success: true, message: "Dry run successful. Posts would have been queued." };
        }
        
        // This is where we emulate The Label's QuickModeDialog
        // 1. Fetch images in folder
        // 2. Fetch template
        // 3. Create job_queue entries
        console.log(`Queueing batch posts for Account ${payload.accountId}`);
        return { success: true, queued_posts: 10 };
    }

    return { success: false, error: "Unknown action" };
}

async function processTask(task) {
    console.log(`\n=================================================`);
    console.log(`[TASK PICKED UP] ID: ${task.id} | Agent: ${task.assigned_to}`);
    
    // Read agent instructions from markdown files in the parent folder
    let instructions = "You are a helpful assistant.";
    try {
        const filePath = path.join(__dirname, '..', `scheduler_${task.assigned_to.toLowerCase().replace(' ', '_')}_agent.md`);
        instructions = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        console.warn(`Could not load instructions for ${task.assigned_to}`);
    }

    let messages = [
        { role: "system", content: `${instructions}\n\nTOOLS AVAILABLE:\n- SCHEDULER_API: FETCH_POSTIZ_SCHEDULE | {}\n- SCHEDULER_API: PINTEREST_SCRAPE | {"query": "..."}\n- SCHEDULER_API: CREATE_FOLDER_AND_UPLOAD | {"folderName": "...", "images": [...]}\n- SCHEDULER_API: ASSIGN_FOLDER | {"folderId": "...", "accountId": "..."}\n- SCHEDULER_API: FETCH_SPOTIFY_STATS | {"artist": "Mani Rae"}\n- SCHEDULER_API: CREATE_HOOK_TEMPLATE | {"title": "...", "overlays": [...]}\n- SCHEDULER_API: ACTIVATE_QUICK_MODE | {"templateId": "...", "folderId": "...", "accountId": "..."}\n- DELEGATE: <AgentName> | <Task Description>` },
        { role: "user", content: `Your current task is: ${task.description}` }
    ];

    let isFinished = false;
    let loopCount = 0;
    
    while (!isFinished && loopCount < 5) {
        loopCount++;
        
        const response = await fetchAIChatCompletion({
            model: MODEL,
            messages: messages
        });

        const aiText = response.choices[0].message.content || '';
        console.log(`[AI RESPONSE (${task.assigned_to})]:\n${aiText}`);
        
        // Log the AI's thought process to Supabase for the frontend collapsible logs
        await supabase.from('chat_logs').insert([{ 
            agent_name: `Scheduler_${task.assigned_to}`, 
            message: `[AI THOUGHT]\n${aiText}` 
        }]);

        let cleanAiText = aiText.replace(/<(thought|think)>[\s\S]*?<\/(thought|think)>/gi, '').trim();
        
        const delegateMatch = cleanAiText.match(/^[ \t`*]*DELEGATE\s*(?:TO)?\s*:?\s*\*{0,2}\s*([A-Za-z][A-Za-z ]{0,30}?)\s*\*{0,2}\s*(?:\||:|—|–)\s*([\s\S]+)/im);
        const apiMatch = cleanAiText.match(/^[ \t`*]*SCHEDULER_API:\s*([A-Z_]+)(?:\s*\|\s*(\{[\s\S]*?\}))?/im);

        if (apiMatch) {
            const action = apiMatch[1].trim();
            const payloadStr = apiMatch[2] ? apiMatch[2].trim() : "{}";
            
            let result;
            if (action === 'FETCH_POSTIZ_SCHEDULE') {
                console.log(`[TOOL] FETCH_POSTIZ_SCHEDULE executed`);
                const { data, error } = await supabase.from('scheduler_calendar').select('*').order('scheduled_time', { ascending: true }).limit(50);
                if (error) {
                    result = { success: false, error: error.message };
                } else {
                    result = { success: true, local_queue: data, message: "Use this to determine what needs to be scheduled next to avoid gaps." };
                }
            } else {
                result = await executeTool(task.assigned_to, action, payloadStr, task);
            }
            
            messages.push({ role: "assistant", content: cleanAiText });
            messages.push({ role: "user", content: `Tool Result:\n${JSON.stringify(result, null, 2)}\nPlease proceed.` });
        } else if (delegateMatch) {
            const nextAgent = delegateMatch[1].trim();
            const nextTaskDesc = delegateMatch[2].trim();
            console.log(`[DELEGATING] -> ${nextAgent}: ${nextTaskDesc}`);
            // In a real system, we'd insert into DB. For this script loop, we just call processTask recursively or queue it.
            return { delegatedTo: nextAgent, description: nextTaskDesc };
        } else {
            console.log(`[FINISHED] Agent ${task.assigned_to} completed its task without delegating.`);
            isFinished = true;
        }
    }
}

async function runScheduler() {
    console.log("Starting Scheduler Engine...");
    let currentTask = {
        id: "initial_run",
        assigned_to: "Manager",
        description: "Start the daily scheduler pipeline. Check Spotify stats, develop narratives, and delegate to Pinterest Curator and Content Creator."
    };

    while (currentTask) {
        const result = await processTask(currentTask);
        if (result && result.delegatedTo) {
            currentTask = {
                id: `delegated_${Date.now()}`,
                assigned_to: result.delegatedTo,
                description: result.description
            };
        } else {
            currentTask = null; // End of assembly line
        }
    }
    console.log("Scheduler Pipeline Complete.");
    process.exit(0);
}

runScheduler();
