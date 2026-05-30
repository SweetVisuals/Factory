
import fetch from 'node-fetch';

const keys = [
  'sk-d703ac9c0fe74d05b1693c50a81ea9bc', // from index.ts
  'sk-6733c8ac2b83402b8626e5e253824488'  // from .env
];

async function testKey(key) {
  console.log(`Testing key: ${key.substring(0, 8)}...`);
  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      })
    });
    console.log(`Status: ${resp.status}`);
    const data = await resp.json();
    if (resp.status === 200) {
      console.log("Success!");
    } else {
      console.log("Error:", data.error || data);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

async function run() {
  for (const key of keys) {
    await testKey(key);
  }
}

run();
