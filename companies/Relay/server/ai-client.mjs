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

// Helper: Load OpenRouter keys from file
function loadOpenRouterKeys() {
  const defaultKeys = [
    process.env.OPENROUTER_API_KEY || "sk-or-v1-dummykey"
  ];

  try {
    const keysPath = path.resolve(__dirname, '../openrouter-api-keys');
    if (fs.existsSync(keysPath)) {
      const content = fs.readFileSync(keysPath, 'utf8');
      const loadedKeys = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('sk-or-'));
      if (loadedKeys.length > 0) {
        return loadedKeys;
      }
    }
  } catch (error) {
    console.error('[AI-Client] Error reading openrouter-api-keys file:', error.message);
  }

  return defaultKeys;
}

const OPENROUTER_MODELS = [
  'openrouter/owl-alpha',
  'z-ai/glm-5.1',
  'minimax/minimax-m2.5:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3-8b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free'
];

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    // Read and parse the body while the abort signal is still active and timeout is running
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

/**
 * Groq-only AI chat completion with multi-model retry chain:
 * Llama 3.3 70B → Llama 3.1 8B → Mixtral
 * 
 * Retries each model with backoff. Does NOT fallback to other providers.
 * 
 * @param {object} params OpenAI-style chat completion params (messages, temperature, response_format, etc.)
 * @param {function} log Optional logger function
 * @returns {Promise<object>} Parsed API response body
 */
export async function fetchAIChatCompletion(params, log = console.log) {
  const {
    messages,
    temperature = 1.0,
    response_format,
    model = 'llama-3.3-70b-versatile'
  } = params;

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error('[AI-Client] GROQ_API_KEY is not configured. Cannot proceed without Groq.');
  }

  const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
  
  // Groq model fallback chain: Llama 3.3 70B (best) → Llama 3.1 8B (fast) → Mixtral (fallback)
  const GROQ_MODEL_CHAIN = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
  
  for (const groqModel of GROQ_MODEL_CHAIN) {
    log(`[AI-Client] Attempting Groq model: ${groqModel}...`);
    
    let retries = 0;
    const maxRetries = 3; // Increased retries since we only have Groq
    let success = false;
    
    while (retries <= maxRetries && !success) {
      try {
        const result = await fetchWithTimeout(GROQ_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: groqModel,
            temperature,
            messages,
            ...(response_format ? { response_format } : {})
          })
        }, 30000); // Increased timeout to 30s

        if (result.ok) {
          const data = result.body;
          if (data && !data.error) {
            log(`[AI-Client] ✅ Groq success using ${groqModel}!`);
            return data;
          } else {
            log(`[AI-Client] Groq API error on ${groqModel}: ${JSON.stringify(data?.error)}`);
            break; // Don't retry on non-rate-limit errors for this model
          }
        } else {
          log(`[AI-Client] Groq ${groqModel} failed (Status ${result.status}): ${typeof result.body === 'string' ? result.body : JSON.stringify(result.body)}`);
          if (result.status === 429) {
            retries++;
            if (retries <= maxRetries) {
              const backoffMs = 3000 * retries; // Exponential backoff: 3s, 6s, 9s
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
