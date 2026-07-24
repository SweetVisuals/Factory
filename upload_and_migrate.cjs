const { Client } = require('ssh2');

const conn = new Client();
const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'UPCWbqAvcAnW';
const LOCAL_FILE = 'C:\\Users\\Shadow\\Desktop\\Factory\\migrations.tar.gz';
const REMOTE_FILE = '/root/migrations.tar.gz';

console.log('🔗 Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('✅ SSH connected.');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    console.log('📤 Uploading migrations archive...');
    sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
      if (err) throw err;
      console.log('✅ Upload complete. Executing SQL migrations...');
      
      const cmd = `
        tar -xzvf /root/migrations.tar.gz -C /root
        echo "Applying schema migrations..."
        for f in $(ls -1 /root/migrations/*.sql | sort); do
          echo "Applying $f..."
          docker exec -i supabase-db psql -U postgres -d postgres < $f
        done
        echo "🎉 All schema migrations applied successfully!"
      `;
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          console.log('--- Migration Finished ---');
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
