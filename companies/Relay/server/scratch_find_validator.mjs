import fs from 'fs';

const content = fs.readFileSync('index.mjs', 'utf8');
const lines = content.split('\n');

const keywords = ['validator', 'strategist', 'validation_status', 'processCity', 'validateEmail', 'insert', 'upsert'];

console.log('--- KEYWORD INDEX IN index.mjs ---');
lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    keywords.forEach(keyword => {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
            console.log(`[Line ${lineNum}] (${keyword}): ${line.trim().substring(0, 100)}`);
        }
    });
});
