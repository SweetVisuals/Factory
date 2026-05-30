const { fetchAIChatCompletion } = require('./ai-client');
require('dotenv').config();

async function run() {
  console.log("Testing OpenRouter with Key 1 and 10s timeout...");
  const start = Date.now();
  try {
    const res = await fetchAIChatCompletion({
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
      model: 'openrouter/owl-alpha'
    }, console.log);
    console.log("Success! Response:", JSON.stringify(res.choices[0].message));
  } catch (err) {
    console.log(`Failed in ${Date.now() - start}ms:`, err.message);
  }
}

run();
