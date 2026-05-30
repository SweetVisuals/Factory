const { fetchAIChatCompletion } = require('./ai-client');
require('dotenv').config();

const messages = [
  { role: 'system', content: 'You are a test agent.' },
  { role: 'user', content: 'Say hello in 3 words.' }
];

async function run() {
  console.log("Starting test call...");
  try {
    const start = Date.now();
    const res = await fetchAIChatCompletion({
      messages,
      model: 'deepseek-v4-flash'
    });
    console.log(`Success in ${Date.now() - start}ms:`, JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

run();
