const fs = require('fs');

const sql = fs.readFileSync('migration_full.sql', 'utf8');

const records = [];
let i = 0;
let startPos = -1;
let inString = false;
let parenLevel = 0;

while (i < sql.length) {
    const char = sql[i];
    if (inString) {
        if (char === "'" && sql[i+1] === "'") {
            i += 2;
        } else if (char === "'") {
            inString = false;
            i++;
        } else {
            i++;
        }
    } else {
        if (char === "'") {
            inString = true;
            i++;
        } else if (char === '(') {
            if (parenLevel === 0) startPos = i;
            parenLevel++;
            i++;
        } else if (char === ')') {
            parenLevel--;
            if (parenLevel === 0 && startPos !== -1) {
                records.push({
                    content: sql.substring(startPos, i + 1),
                    startLine: sql.substring(0, startPos).split('\n').length
                });
                startPos = -1;
            }
            i++;
        } else {
            i++;
        }
    }
}

console.log(`Extracted ${records.length} blocks.`);

records.forEach((r, idx) => {
    // Only check blocks that look like records (start with UUID or something)
    if (!r.content.match(/^\('[0-9a-f-]{36}'/)) return;

    // Count commas outside of strings
    let commas = 0;
    let sInString = false;
    for (let j = 0; j < r.content.length; j++) {
        const c = r.content[j];
        if (sInString) {
            if (c === "'" && r.content[j+1] === "'") j++;
            else if (c === "'") sInString = false;
        } else {
            if (c === "'") sInString = true;
            else if (c === ',') commas++;
        }
    }

    // For leads, we expect 18 commas (19 columns)
    if (commas !== 18 && commas !== 7 && commas !== 1 && commas !== 5 && commas !== 16) {
        // 7 for campaigns, 1 for campaign_leads, 5 for warmup, 16 for email_accounts
        console.log(`Possible error at line ${r.startLine}: Commas=${commas}`);
        console.log(r.content.substring(0, 100) + '...');
    }
});
