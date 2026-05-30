import { createClient } from '@supabase/supabase-js';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const execFilePromise = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const HERMES_PYTHON = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe";
const HERMES_BASE = "C:\\Users\\Shadow\\AppData\\Local\\hermes\\hermes-agent";
const HERMES_CLI = path.join(HERMES_BASE, "hermes");

async function runHermes(prompt) {
  console.log(`[Hermes] Executing: ${prompt}`);
  try {
    const { stdout } = await execFilePromise(HERMES_PYTHON, [HERMES_CLI, 'chat', '-q', prompt, '-Q', '--yolo'], {
      cwd: HERMES_BASE,
      env: { 
        ...process.env, 
        PYTHONPATH: HERMES_BASE,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        OPENAI_API_KEY: process.env.DEEPSEEK_API_KEY
      }
    });
    return stdout;
  } catch (err) {
    console.error(`[Hermes Error] ${err.message}`);
    return "";
  }
}

async function orchestrate() {
  console.log('[Orchestrator] Starting autonomous loop...');
  
  try {
    // 1. Find campaigns that need leads
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active');
      
    if (error) throw error;

    for (const campaign of campaigns) {
      console.log(`[Orchestrator] Auditing Campaign: ${campaign.name}`);
      
      // Check lead count
      const { count, error: countError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);
        
      if (countError) continue;
      
      if (count < 1000) {
        console.log(`[Orchestrator] Campaign ${campaign.name} is low on leads (${count}/1000). Triggering Hermes...`);
        
        const prompt = `Find 50 new B2B business leads for the niche "${campaign.niche || campaign.name}" in the location "${campaign.location || 'USA'}". 
        CRITICAL: We ONLY want leads with valid work email addresses. 
        Return them as a JSON array of objects with fields: name, email, website, description, company, location. 
        Only return the JSON. No talk.`;
        
        const result = await runHermes(prompt);
        
        // Parse results and save to DB
        try {
          const jsonStart = result.indexOf('[');
          const jsonEnd = result.lastIndexOf(']') + 1;
          if (jsonStart === -1 || jsonEnd === 0) throw new Error("No JSON array found in output");

          const leads = JSON.parse(result.substring(jsonStart, jsonEnd));
          
          let added = 0;
          for (const lead of leads) {
            if (!lead.email || !lead.email.includes('@')) continue;
            
            await supabase.from('leads').upsert({
              ...lead,
              campaign_id: campaign.id,
              status: 'new',
              source: 'hermes_orchestrator'
            });
            added++;
          }
          console.log(`[Orchestrator] Hermes successfully added ${added} valid email leads to ${campaign.name}`);
        } catch (e) {
          console.error(`[Orchestrator] Failed to parse Hermes output: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Orchestrator] Error: ${err.message}`);
  }
}

// Run every 5 minutes
setInterval(orchestrate, 5 * 60 * 1000);
orchestrate(); // Initial run
