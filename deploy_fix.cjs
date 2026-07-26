const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '5.75.252.100';
const username = 'root';
const password = '4ULxwjLbbKxM';
const appDir = path.join(__dirname, 'companies', 'Relay');
const filePath = path.join(appDir, 'server', 'index.mjs');
const aiClientPath = path.join(appDir, 'server', 'ai-client.mjs');

console.log('Uploading to Hetzner...');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    sftp.fastPut(filePath, '/root/Factory/companies/Relay/server/index.mjs', (err) => {
      if (err) throw err;
      
      console.log('Uploading ai-client.mjs...');
      sftp.fastPut(aiClientPath, '/root/Factory/companies/Relay/server/ai-client.mjs', (err) => {
        if (err) throw err;
        
        console.log('Upload complete. Restarting PM2...');
        
        const extractScript = "cd /root/Factory/companies/Relay/server && pm2 restart relay-backend";
        
        conn.exec(extractScript, (err, stream) => {
          if (err) throw err;
          stream.on('close', () => {
              console.log('Backend restarted successfully.');
              conn.end();
          }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
        });
      });
    });
  });
}).connect({ host, port: 22, username, password, readyTimeout: 60000 });
