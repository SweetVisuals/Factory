const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('migration_full.sql', 'utf8');
const chunks = content.split(/INSERT INTO/i);

const tables = {};

chunks.forEach((chunk, i) => {
    if (i === 0) return;
    
    const tableMatch = chunk.match(/public\.(\w+)/);
    if (!tableMatch) return;
    
    const tableName = tableMatch[1];
    if (!tables[tableName]) tables[tableName] = [];
    
    // Add back the INSERT INTO
    tables[tableName].push('INSERT INTO ' + chunk.trim());
});

if (!fs.existsSync('migration_split')) fs.mkdirSync('migration_split');

for (const [table, contents] of Object.entries(tables)) {
    fs.writeFileSync(path.join('migration_split', `${table}.sql`), contents.join('\n'));
    console.log(`Created migration_split/${table}.sql with ${contents.length} blocks.`);
}
