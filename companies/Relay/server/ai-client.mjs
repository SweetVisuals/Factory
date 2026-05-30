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
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY",
    "process.env.OPENROUTER_API_KEY"
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
 * Robust AI chat completion with fallback to OpenRouter key cycling and free models.
 * Matches the interface of the OpenAI / DeepSeek completions API.
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
    model = 'openrouter/owl-alpha'
  } = params;

  // 1. Load OpenRouter keys and try OpenRouter first
  const openRouterKeys = loadOpenRouterKeys();
  const openRouterModel = model.includes('deepseek') ? 'openrouter/owl-alpha' : model;

  // Check if DeepSeek is disabled in admin settings
  let deepseekDisabled = false;
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from('api_keys')
        .select('key_value')
        .eq('service', 'disable_deepseek')
        .maybeSingle();
      if (data && data.key_value === 'true') {
        deepseekDisabled = true;
      }
    } catch (err) {
      log(`[AI-Client] Error checking DeepSeek setting: ${err.message}`);
    }
  }

  log(`[AI-Client] Loaded ${openRouterKeys.length} OpenRouter API keys.`);
  log(`[AI-Client] Attempting primary model: ${openRouterModel} via OpenRouter...`);

  // Cycle through each API Key for this model on OpenRouter
  for (let i = 0; i < openRouterKeys.length; i++) {
    const apiKey = openRouterKeys[i];
    const keySnippet = `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 8)}`;

    const cooldownTime = keyCooldowns.get(apiKey);
    if (cooldownTime && Date.now() < cooldownTime) {
      const remaining = Math.round((cooldownTime - Date.now()) / 1000);
      log(`[AI-Client] Skipping Key ${i + 1}/${openRouterKeys.length} (${keySnippet}) (on cooldown for another ${remaining}s)`);
      continue;
    }

    log(`[AI-Client] Trying Key ${i + 1}/${openRouterKeys.length} (${keySnippet}) for ${openRouterModel} (with 15s timeout)...`);

    try {
      const result = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/Openclaw-Factory',
          'X-Title': 'ColdSpark'
        },
        body: JSON.stringify({
          model: openRouterModel,
          temperature,
          messages,
          ...(response_format ? { response_format } : {})
        })
      }, 15000);

      if (result.ok) {
        const data = result.body;
        if (data && !data.error) {
          log(`[AI-Client] OpenRouter success using ${openRouterModel} with Key ${i + 1}!`);
          return data;
        } else {
          const innerError = data?.error?.message || JSON.stringify(data?.error);
          log(`[AI-Client] OpenRouter Key ${i + 1} responded with API error: ${innerError}`);
          keyCooldowns.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
        }
      } else {
        const errorText = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
        log(`[AI-Client] OpenRouter Key ${i + 1} request failed (Status ${result.status}): ${errorText}`);
        keyCooldowns.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
      }
    } catch (err) {
      log(`[AI-Client] OpenRouter Key ${i + 1} network exception or timeout: ${err.message}`);
      keyCooldowns.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
    }

    log(`[AI-Client] Key ${i + 1} failed or hit limits. Cycling to the next key...`);
  }

  log(`[AI-Client] All OpenRouter keys exhausted or limited for model ${openRouterModel}. Falling back to DeepSeek...`);

  // 2. Try DeepSeek (Fallback)
  if (deepseekDisabled) {
    log(`[AI-Client] DeepSeek model is disabled by admin setting. Skipping direct DeepSeek fallback...`);
  } else {
    const deepseekKey = process.env.DEEPSEEK_API_KEY || 'sk-d703ac9c0fe74d05b1693c50a81ea9bc';
    const deepseekUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const deepseekModel = model.includes('deepseek') ? model : 'deepseek-v4-flash';

    log(`[AI-Client] Attempting fallback model: ${deepseekModel} via DeepSeek (with 15s timeout)...`);
    try {
      const result = await fetchWithTimeout(`${deepseekUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: deepseekModel,
          temperature,
          messages,
          ...(response_format ? { response_format } : {})
        })
      }, 15000);

      const isOutOfCredits = result.status === 402;
      let data = result.ok ? result.body : null;

      if (result.ok) {
        if (data && !data.error) {
          log(`[AI-Client] Fallback DeepSeek call succeeded.`);
          return data;
        }
      }

      // If we didn't return, parse error information if available
      let errorMsg = `HTTP Error ${result.status}`;
      try {
        const errData = result.body;
        if (errData?.error?.message) errorMsg = errData.error.message;
        else if (typeof errData === 'string') errorMsg = errData;
      } catch (_) {}

      log(`[AI-Client] DeepSeek failed: ${errorMsg}. Status: ${result.status}`);

      const isCreditError = isOutOfCredits || 
        errorMsg.toLowerCase().includes('balance') || 
        errorMsg.toLowerCase().includes('credit') || 
        errorMsg.toLowerCase().includes('payment') || 
        errorMsg.toLowerCase().includes('quota');

      if (isCreditError) {
        log(`[AI-Client] DeepSeek credit depletion detected!`);
      }

    } catch (error) {
      log(`[AI-Client] DeepSeek network/runtime failure or timeout: ${error.message}.`);
    }
  }

  log(`[AI-Client] DeepSeek failed. Trying other OpenRouter free models as a last resort fallback...`);

  // 3. OpenRouter Free Models Last Resort Fallback Logic
  for (const routerModel of OPENROUTER_MODELS) {
    if (routerModel === openRouterModel) continue; // Skip since we already tried it
    log(`[AI-Client] Trying OpenRouter model: ${routerModel}`);

    // Cycle through each API Key for this model
    for (let i = 0; i < openRouterKeys.length; i++) {
      const apiKey = openRouterKeys[i];
      const keySnippet = `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 8)}`;

      const cooldownTime = keyCooldowns.get(apiKey);
      if (cooldownTime && Date.now() < cooldownTime) {
        const remaining = Math.round((cooldownTime - Date.now()) / 1000);
        log(`[AI-Client] Skipping Key ${i + 1}/${openRouterKeys.length} (${keySnippet}) (on cooldown for another ${remaining}s)`);
        continue;
      }

      log(`[AI-Client] Trying Key ${i + 1}/${openRouterKeys.length} (${keySnippet}) for ${routerModel} (with 15s timeout)...`);

      try {
        const result = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/Openclaw-Factory',
            'X-Title': 'ColdSpark'
          },
          body: JSON.stringify({
            model: routerModel,
            temperature,
            messages,
            ...(response_format ? { response_format } : {})
          })
        }, 15000);

        if (result.ok) {
          const data = result.body;
          if (data && !data.error) {
            log(`[AI-Client] OpenRouter success using ${routerModel} with Key ${i + 1}!`);
            return data;
          } else {
            const innerError = data?.error?.message || JSON.stringify(data?.error);
            log(`[AI-Client] OpenRouter Key ${i + 1} responded with API error: ${innerError}`);
            keyCooldowns.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
          }
        } else {
          const errorText = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
          log(`[AI-Client] OpenRouter Key ${i + 1} request failed (Status ${result.status}): ${errorText}`);
          keyCooldowns.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
        }
      } catch (err) {
        log(`[AI-Client] OpenRouter Key ${i + 1} network exception or timeout: ${err.message}`);
        keyCooldowns.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
      }

      log(`[AI-Client] Key ${i + 1} failed or hit limits. Cycling to the next key...`);
    }

    log(`[AI-Client] All keys exhausted or limited for model ${routerModel}. Trying next free model...`);
  }

  throw new Error('[AI-Client] All AI providers, models, and keys have been exhausted and failed.');
}
