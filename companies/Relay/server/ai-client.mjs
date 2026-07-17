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

  // Provider fallback chain: Groq (primary) → Routeway (emergency fallback only)
  // NOTE: Routeway Step 3.5 Flash has a 200 req/day limit - only use if Groq is completely down
  const PROVIDER_CHAIN = [
    {
      name: 'Groq',
      key: () => process.env.GROQ_API_KEY,
      base: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
      headers: (key) => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      })
    },
    {
      name: 'Routeway',
      key: () => process.env.ROUTEWAY_API_KEY || 'sk-Y7mZwBr2W1xdNK5Fu594MHALSlTV8E2Buvq0Bq8YwWwaM4I-oSTi9Hu97kVfZOQ',
      base: 'https://api.routeway.ai/v1/chat/completions',
      models: ['step-3.5-flash:free'],
      headers: (key) => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      })
    }
  ];

  for (const provider of PROVIDER_CHAIN) {
    const apiKey = provider.key();
    if (!apiKey) {
      log(`[AI-Client] Skipping ${provider.name}: no API key configured`);
      continue;
    }

    for (const model of provider.models) {
      log(`[AI-Client] Attempting ${provider.name} model: ${model}...`);
      
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          const result = await fetchWithTimeout(provider.base, {
            method: 'POST',
            headers: provider.headers(apiKey),
            body: JSON.stringify({
              model,
              temperature,
              messages,
              ...(response_format ? { response_format } : {})
            })
          }, 30000);

          if (result.ok) {
            const data = result.body;
            if (data && !data.error) {
              log(`[AI-Client] ✅ ${provider.name} success using ${model}!`);
              return data;
            } else {
              log(`[AI-Client] ${provider.name} API error on ${model}: ${JSON.stringify(data?.error)}`);
              break;
            }
          } else {
            log(`[AI-Client] ${provider.name} ${model} failed (Status ${result.status}): ${typeof result.body === 'string' ? result.body : JSON.stringify(result.body)}`);
            if (result.status === 429) {
              retries++;
              if (retries <= maxRetries) {
                const backoffMs = 2000 * retries;
                log(`[AI-Client] ${provider.name} rate limited. Retrying in ${backoffMs}ms... (Attempt ${retries}/${maxRetries})`);
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
              }
            }
            break;
          }
        } catch (err) {
          log(`[AI-Client] ${provider.name} ${model} exception: ${err.message}`);
          retries++;
          if (retries <= maxRetries) {
            const backoffMs = 2000 * retries;
            log(`[AI-Client] Retrying in ${backoffMs}ms... (Attempt ${retries}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoffMs));
          }
        }
      }
    }
  }

  throw new Error('[AI-Client] All providers and models exhausted after retries. Please try again later.');
}
