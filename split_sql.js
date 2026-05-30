const fs = require('fs');
const content = fs.readFileSync('migration_full.sql', 'utf8');
const lines = content.split('\n');
const chunkSize = 2000;

for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize).join('\n');
    fs.writeFileSync(`migration_chunk_${i / chunkSize}.sql`, chunk);
}
console.log(`Split into ${Math.ceil(lines.length / chunkSize)} chunks`);
