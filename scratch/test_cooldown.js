const fs = require('fs');
const path = require('path');
const logFile = path.resolve(__dirname, 'test_log.txt');

// Reset log file
fs.writeFileSync(logFile, '');

console.log = function(...args) {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ') + '\n';
  fs.appendFileSync(logFile, msg);
  process.stdout.write(msg); // also write to stdout
};

const { fetchAIChatCompletion } = require('../backend/ai-client');
require('dotenv').config();

async function run() {
  console.log("=== FIRST RUN ===");
  try {
    await fetchAIChatCompletion({
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
      model: 'openrouter/owl-alpha'
    }, console.log);
  } catch (err) {
    console.log("First run failed:", err.message);
  }

  console.log("\n=== SECOND RUN ===");
  try {
    await fetchAIChatCompletion({
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
      model: 'openrouter/owl-alpha'
    }, console.log);
  } catch (err) {
    console.log("Second run failed:", err.message);
  }
}

run();
