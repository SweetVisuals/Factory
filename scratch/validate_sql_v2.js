const fs = require('fs');

const sql = fs.readFileSync('migration_full.sql', 'utf8');

// Split by INSERT INTO
const statements = sql.split(/INSERT INTO/i);

let totalRecords = 0;
let errors = [];

statements.forEach((stmt, sIdx) => {
    if (sIdx === 0) return; // Skip before first INSERT

    const tableMatch = stmt.match(/public\.(\w+)/);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';
    
    // Find column names
    const colStart = stmt.indexOf('(');
    const colEnd = stmt.indexOf(')', colStart);
    const cols = stmt.substring(colStart + 1, colEnd).split(',').map(c => c.trim());
    const expectedLength = cols.length;

    console.log(`Table: ${tableName}, Expected Columns: ${expectedLength}`);

    // Find VALUES
    const valuesIndex = stmt.indexOf('VALUES');
    if (valuesIndex === -1) return;

    let data = stmt.substring(valuesIndex + 6).trim();
    // Remove ( if it starts with it
    if (data.startsWith('(')) data = data.substring(1);
    
    // Simple parser
    let i = 0;
    let currentRecord = [];
    let currentVal = '';
    let inString = false;
    let recordCount = 0;

    while (i < data.length) {
        const char = data[i];
        const nextChar = data[i + 1];

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
                recordCount++;
                totalRecords++;
                
                if (currentRecord.length !== expectedLength) {
                    errors.push({
                        table: tableName,
                        recordIndex: recordCount,
                        expected: expectedLength,
                        actual: currentRecord.length,
                        values: currentRecord
                    });
                }
                
                // Check for B Food Truck
                if (currentRecord.some(v => v.includes('B Food Truck'))) {
                    console.log(`Found B Food Truck in table ${tableName}, record ${recordCount}`);
                }

                currentRecord = [];
                currentVal = '';
                
                // Skip ), (
                while (i < data.length && (data[i] === ')' || data[i] === ',' || data[i] === '(' || /\s/.test(data[i]))) {
                    i++;
                }
                
                // If we hit ; or next INSERT or ON CONFLICT, stop
                if (data.substring(i).toUpperCase().startsWith('ON CONFLICT')) break;
                if (data[i] === ';') break;
            } else if (/\s/.test(char)) {
                i++;
            } else {
                currentVal += char;
                i++;
            }
        }
    }
    console.log(`Processed ${recordCount} records for ${tableName}`);
});

console.log(`Total records processed: ${totalRecords}`);
console.log(`Total errors found: ${errors.length}`);

errors.forEach(err => {
    console.log(`Error in ${err.table} at record ${err.recordIndex}: Expected ${err.expected}, got ${err.actual}`);
    if (err.values.some(v => v.includes('B Food Truck'))) {
        console.log('THIS IS THE B FOOD TRUCK RECORD');
    }
    console.log('Record start:', err.values.slice(0, 3));
});
