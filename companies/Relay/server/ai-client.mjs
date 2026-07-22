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
    temperature = 0.3,
    response_format,
    model = 'deepseek-chat',
    max_tokens = 150
  } = params;

  // 1. Try DeepSeek API first if key exists (most cost-efficient)
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (DEEPSEEK_API_KEY) {
    log(`[AI-Client] Attempting DeepSeek API (deepseek-chat)...`);
    try {
      const dsResult = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          temperature,
          messages,
          max_tokens,
          ...(response_format ? { response_format } : {})
        })
      }, 15000);

      if (dsResult.ok && dsResult.body && dsResult.body.choices && dsResult.body.choices[0]) {
        log(`[AI-Client] ✅ DeepSeek success!`);
        return dsResult.body;
      } else {
        log(`[AI-Client] DeepSeek failed (Status ${dsResult.status}): ${typeof dsResult.body === 'string' ? dsResult.body : JSON.stringify(dsResult.body)}`);
      }
    } catch (dsErr) {
      log(`[AI-Client] DeepSeek exception: ${dsErr.message}`);
    }
  }

  // 2. Fall back to Groq API
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    throw new Error('[AI-Client] Neither DEEPSEEK_API_KEY nor GROQ_API_KEY are configured.');
  }

  const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL_CHAIN = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192'];
  
  for (const groqModel of GROQ_MODEL_CHAIN) {
    log(`[AI-Client] Attempting Groq model: ${groqModel}...`);
    
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
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
            max_tokens,
            ...(response_format ? { response_format } : {})
          })
        }, 15000);

        if (result.ok && result.body && !result.body.error) {
          log(`[AI-Client] ✅ Groq success using ${groqModel}!`);
          return result.body;
        } else {
          log(`[AI-Client] Groq ${groqModel} failed (Status ${result.status})`);
          break;
        }
      } catch (err) {
        log(`[AI-Client] Groq ${groqModel} exception: ${err.message}`);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * retries));
        }
      }
    }
  }

  throw new Error('[AI-Client] All AI providers (DeepSeek & Groq) exhausted after retries.');
}