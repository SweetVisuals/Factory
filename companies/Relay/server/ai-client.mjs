import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseClient = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Global cache to prevent trying rate-limited or failed keys repeatedly.
const keyCooldowns = new Map();
const KEY_COOLDOWN_MS = 5 * 60 * 1000;

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    let body;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
    
    clearTimeout(id);
    return {
      ok: response.ok,
      status: response.status,
      body
    };
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function fetchAIChatCompletion(params, log = console.log) {
  const {
    messages,
    temperature = 1.0,
    response_format,
    model = 'llama-3.3-70b-versatile'
  } = params;

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    throw new Error('[AI-Client] GROQ_API_KEY is not configured. Cannot proceed without Groq.');
  }

  const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
  
  // Groq-only model chain: Llama 3.3 70B (best) → Llama 3.1 8B (fast) → Mixtral (fallback)
  const GROQ_MODEL_CHAIN = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
  
  for (const groqModel of GROQ_MODEL_CHAIN) {
    log(`[AI-Client] Attempting Groq model: ${groqModel}...`);
    
    let retries = 0;
    const maxRetries = 3;
    let success = false;
    
    while (retries <= maxRetries && !success) {
      try {
        const result = await fetchWithTimeout(GROQ_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: groqModel,
            temperature,
            messages,
            ...(response_format ? { response_format } : {})
          })
        }, 30000);

        if (result.ok) {
          const data = result.body;
          if (data && !data.error) {
            log(`[AI-Client] ✅ Groq success using ${groqModel}!`);
            return data;
          } else {
            log(`[AI-Client] Groq API error on ${groqModel}: ${JSON.stringify(data?.error)}`);
            break;
          }
        } else {
          log(`[AI-Client] Groq ${groqModel} failed (Status ${result.status}): ${typeof result.body === 'string' ? result.body : JSON.stringify(result.body)}`);
          if (result.status === 429) {
            retries++;
            if (retries <= maxRetries) {
              const backoffMs = 3000 * retries;
              log(`[AI-Client] Groq rate limited. Retrying in ${backoffMs}ms... (Attempt ${retries}/${maxRetries})`);
              await new Promise(r => setTimeout(r, backoffMs));
              continue;
            }
          }
          break;
        }
      } catch (err) {
        log(`[AI-Client] Groq ${groqModel} exception: ${err.message}`);
        retries++;
        if (retries <= maxRetries) {
          const backoffMs = 3000 * retries;
          log(`[AI-Client] Retrying in ${backoffMs}ms... (Attempt ${retries}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }
  }

  throw new Error('[AI-Client] All Groq models exhausted after retries. Please try again later.');
}