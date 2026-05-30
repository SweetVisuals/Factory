const fs = require('fs');
const path = require('path');
const { fetchAIChatCompletion } = require('./ai-client');
require('dotenv').config();

async function run() {
  console.log("Loading large description...");
  // Load description from step output in Gemini App Data directory
  const outputText = fs.readFileSync('C:\\Users\\Shadow\\.gemini\\antigravity\\brain\\0a436ff5-4d42-434e-ac6e-5f6973f2a538\\.system_generated\\steps\\1333\\output.txt', 'utf8');
  const data = JSON.parse(outputText);
  const resultStr = data.result;
  const match = resultStr.match(/\[\{"description":"([\s\S]*?)"\}\]/);
  const description = match ? JSON.parse(`"${match[1]}"`) : "";

  console.log(`Loaded description: ${description.length} chars (~${Math.round(description.length/4)} tokens)`);

  const messages = [
    { role: 'system', content: 'You are the Boss of Openclaw Factory. Review the campaign dashboard and output commands like RELAY_API or DELEGATE to direct the assembly line.' },
    { role: 'user', content: description }
  ];

  console.log("Starting large context test call (timeout 90s)...");
  try {
    const start = Date.now();
    const res = await fetchAIChatCompletion({
      messages,
      model: 'deepseek-v4-flash'
    });
    console.log(`Success in ${Date.now() - start}ms:`, res.choices[0].message.content.substring(0, 300) + "...");
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

run();
