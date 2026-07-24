const { Client } = require('ssh2');

const conn = new Client();
const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'UPCWbqAvcAnW';
const LOCAL_FILE = 'C:\\Users\\Shadow\\Desktop\\Factory\\functions.tar.gz';
const REMOTE_FILE = '/root/functions.tar.gz';

console.log('🔗 Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('✅ SSH connected.');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    console.log('📤 Uploading functions archive...');
    sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
      if (err) throw err;
      console.log('✅ Upload complete. Updating Edge Functions...');
      
      const cmd = `
        tar -xzvf /root/functions.tar.gz -C /root
        cp -r /root/functions/* /root/supabase/docker/volumes/functions/
        docker restart supabase-edge-functions
        echo "🎉 Edge Functions Deployed successfully!"
      `;
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          console.log('--- Deployment Finished ---');
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
