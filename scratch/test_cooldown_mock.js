const { fetchAIChatCompletion } = require('../backend/ai-client');
require('dotenv').config();

// Save original fetch
const originalFetch = global.fetch;

let fetchCallCount = 0;
global.fetch = async (url, options) => {
  fetchCallCount++;
  const authHeader = options?.headers?.Authorization || '';
  const keySnippet = authHeader ? authHeader.replace('Bearer ', '').substring(0, 12) + '...' : 'no-key';
  console.log(`[Mock Fetch] Called for ${url} with key ${keySnippet}`);
  
  // Return an error/rate-limit response immediately
  return {
    ok: false,
    status: 429,
    headers: {
      get: (name) => {
        if (name.toLowerCase() === 'content-type') return 'application/json';
        return null;
      }
    },
    json: async () => ({ error: { message: "Rate limit exceeded" } }),
    text: async () => '{"error": {"message": "Rate limit exceeded"}}'
  };
};

async function run() {
  console.log("=== FIRST RUN (Expect all keys to fail and get placed on cooldown) ===");
  try {
    await fetchAIChatCompletion({
      messages: [{ role: 'user', content: 'test' }],
      model: 'openrouter/owl-alpha'
    }, console.log);
  } catch (err) {
    console.log("First run completed/failed as expected:", err.message);
  }

  console.log("\n=== SECOND RUN (Expect keys to be skipped instantly due to cooldown cache) ===");
  fetchCallCount = 0;
  try {
    await fetchAIChatCompletion({
      messages: [{ role: 'user', content: 'test' }],
      model: 'openrouter/owl-alpha'
    }, console.log);
  } catch (err) {
    console.log("Second run completed/failed as expected:", err.message);
  }

  // Restore fetch
  global.fetch = originalFetch;
}

run();
