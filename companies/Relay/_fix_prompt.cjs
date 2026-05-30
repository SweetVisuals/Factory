const fs = require('fs');
const f = 'supabase/functions/process-campaign/index.ts';
let c = fs.readFileSync(f, 'utf8');

// Find the exact text using a unique identifier
const marker = 'You are a friendly B2B professional companion';
const idx = c.indexOf(marker);
if (idx === -1) {
    console.log('Marker not found');
    process.exit(1);
}

// Find start of the const systemPrompt line
const lineStart = c.lastIndexOf('const systemPrompt', idx);
if (lineStart === -1) {
    console.log('Could not find const systemPrompt before marker');
    process.exit(1);
}

// Find the end of userPrompt (the closing backtick+semicolon after "Rewrite the email body for this lead")
const endMarker = 'Rewrite the email body for this lead.';
const endIdx = c.indexOf(endMarker, idx);
if (endIdx === -1) {
    console.log('Could not find end marker');
    process.exit(1);
}

// Find the semicolon after the closing backtick
let endPos = endIdx + endMarker.length;
// Skip past backtick and semicolon
while (endPos < c.length && c[endPos] !== ';') endPos++;
endPos++; // include the semicolon

const oldChunk = c.substring(lineStart, endPos);
console.log('Found chunk length:', oldChunk.length);
console.log('First 100 chars:', JSON.stringify(oldChunk.substring(0, 100)));

// Build replacement
const nl = oldChunk.includes('\r\n') ? '\r\n' : '\n';
const indent = c.substring(c.lastIndexOf(nl, lineStart) + nl.length, lineStart);

const newChunk = `const leadFirstName = (lead.name || '').split(' ')[0] || 'there';${nl}${indent}const systemPrompt = \`You are rewriting a cold email to feel personal and human for a specific lead.${nl}Personality: Friendly, genuinely curious, slightly witty. You sound like a helpful colleague, not a marketing bot.${nl}${nl}Instructions:${nl}1. Use the notes to make a natural, specific observation. Rephrase - don't copy-paste.${nl}2. Greeting: Use "Hi \${leadFirstName}," - NEVER use full name or last name.${nl}3. NEVER mention the lead's job title or role anywhere.${nl}4. Tone: Warm, concise, genuinely helpful. Like messaging someone you want to work with.${nl}5. Length: Under 80 words. Every sentence earns its place.${nl}6. Output: ONLY the email body text. NO SIGN-OFF (it is added automatically).${nl}\`;${nl}${indent}const userPrompt = \`Template Body: "\${schedule.templates.content}"${nl}Lead: \${leadFirstName} at \${lead.company}${nl}Notes: "\${lead.summary}"${nl}Rewrite for this lead. Do NOT mention their role/title. First name only. Keep it short and genuine.\`;`;

c = c.replace(oldChunk, newChunk);
fs.writeFileSync(f, c);
console.log('SUCCESS - JIT prompt updated');
