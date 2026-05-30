const fs = require('fs');

const sql = fs.readFileSync('migration_full.sql', 'utf8');

// Find the start of VALUES
const valuesStart = sql.indexOf('VALUES');
if (valuesStart === -1) {
    console.error('Could not find VALUES in SQL');
    process.exit(1);
}

// Extract everything after VALUES (
let data = sql.substring(valuesStart + 6).trim();
if (data.startsWith('(')) {
    data = data.substring(1);
}

// Very simple parser for (val1, val2, ...), (val1, val2, ...)
// Handle escaped quotes ''
function parseSqlValues(str) {
    const records = [];
    let currentRecord = [];
    let currentVal = '';
    let inString = false;
    let i = 0;

    while (i < str.length) {
        const char = str[i];
        const nextChar = str[i + 1];

        if (inString) {
            if (char === "'" && nextChar === "'") {
                currentVal += "'";
                i += 2;
            } else if (char === "'") {
                inString = false;
                i++;
            } else {
                currentVal += char;
                i++;
            }
        } else {
            if (char === "'") {
                inString = true;
                i++;
            } else if (char === ',') {
                currentRecord.push(currentVal.trim());
                currentVal = '';
                i++;
            } else if (char === ')') {
                currentRecord.push(currentVal.trim());
                records.push(currentRecord);
                currentRecord = [];
                currentVal = '';
                
                // Skip ), (
                while (i < str.length && (str[i] === ')' || str[i] === ',' || str[i] === '(' || str[i] === ';' || /\s/.test(str[i]))) {
                    i++;
                }
            } else if (/\s/.test(char)) {
                i++;
            } else {
                currentVal += char;
                i++;
            }
        }
    }
    return records;
}

console.log('Parsing records...');
const records = parseSqlValues(data);
console.log(`Found ${records.length} records.`);

let errorCount = 0;
records.forEach((record, index) => {
    if (record.length !== 19) {
        console.log(`Error at record ${index}: Expected 19 columns, got ${record.length}`);
        console.log('First 5 values:', record.slice(0, 5));
        console.log('Last 5 values:', record.slice(-5));
        errorCount++;
    }
});

if (errorCount === 0) {
    console.log('All records have 19 columns.');
} else {
    console.log(`Found ${errorCount} errors.`);
}
