const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'mjaXRVMmbMwC7xCbcLCE123';

const conn = new Client();

console.log('🔗 Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('✅ SSH connected.');
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ SFTP error:', err.message);
      conn.end();
      return;
    }

    const localEnvPath = path.resolve(__dirname, '.env');
    const remoteEnvPath = '/root/Factory/companies/Relay/.env';

    console.log(`🚀 Uploading .env to ${remoteEnvPath}...`);
    
    sftp.fastPut(localEnvPath, remoteEnvPath, (err) => {
      if (err) {
        console.error('❌ Failed to upload .env:', err.message);
        conn.end();
        return;
      }
      
      console.log('✅ .env uploaded successfully.');
      
      console.log('🔄 Restarting PM2 services...');
      conn.exec('cd /root/Factory/companies/Relay && pm2 restart all --update-env', (err, stream) => {
        if (err) {
          console.error('❌ Exec error:', err.message);
          conn.end();
          return;
        }
        
        stream.on('close', (code, signal) => {
          console.log(`✅ PM2 restarted (code: ${code}).`);
          conn.end();
        }).on('data', (data) => {
          console.log(`PM2: ${data}`);
        }).stderr.on('data', (data) => {
          console.error(`PM2 Error: ${data}`);
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('❌ SSH connection error:', err.message);
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 10000
});
