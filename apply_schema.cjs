const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const sqlFiles = ['full_schema.sql'];

let allSql = '';
const baseDir = 'C:\\\\Users\\\\Shadow\\\\Desktop\\\\persona-hub';
for (const file of sqlFiles) {
    allSql += fs.readFileSync(path.join(baseDir, file), 'utf8') + '\n\n';
}

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec('cat > /tmp/schema.sql && docker exec -i supabase-db psql -U postgres -d postgres < /tmp/schema.sql', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
        
        // Write the SQL to the stream
        stream.write(allSql);
        stream.end();
    });
}).connect({
    host: '5.75.252.100',
    port: 22,
    username: 'root',
    password: 'xuLfidHVumt9',
    readyTimeout: 30000
});
