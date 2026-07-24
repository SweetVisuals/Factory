const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'UPCWbqAvcAnW';
const LOCAL_FILE = 'C:\\Users\\Shadow\\Desktop\\Factory\\migration_full.sql';
const REMOTE_FILE = '/root/migration_full.sql';

console.log('🔗 Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('✅ SSH connected.');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    console.log('📤 Uploading data migration file (1.9MB)...');
    sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
      if (err) throw err;
      console.log('✅ Upload complete. Executing SQL data migration...');
      
      const cmd = `
        echo "Applying data migration..."
        docker exec -i supabase-db psql -U postgres -d postgres < /root/migration_full.sql
        echo "🎉 Data migration applied successfully!"
      `;
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          console.log('--- Data Migration Finished ---');
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
          process.stderr.write(data.toString());
        });
      });
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 60000
});
