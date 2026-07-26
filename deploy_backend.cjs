const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '5.75.252.100';
const username = 'root';
const password = '4ULxwjLbbKxM';
const appDir = path.join(__dirname, 'companies', 'Relay');
const filePath = path.join(appDir, 'server', 'scraper_scheduler_cron.mjs');

console.log('Uploading scraper backend to Hetzner...');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    sftp.fastPut(filePath, '/root/Factory/companies/Relay/server/scraper_scheduler_cron.mjs', (err) => {
      if (err) throw err;
      
      console.log('Upload complete. Restarting PM2...');
      
      const extractScript = `
        cd /root/Factory/companies/Relay/server
        pm2 restart relay-cron
        pm2 restart relay-backend
      `;
      
      conn.exec(extractScript, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Backend restarted.');
            conn.end();
        }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    });
  });
}).connect({ host, port: 22, username, password, readyTimeout: 60000 });
