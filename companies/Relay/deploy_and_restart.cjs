const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  // Read all files to upload
  const senderContent = fs.readFileSync(path.resolve(__dirname, 'server/campaign_sender.mjs'), 'utf8');
  const indexContent = fs.readFileSync(path.resolve(__dirname, 'server/index.mjs'), 'utf8');
  const cronContent = fs.readFileSync(path.resolve(__dirname, 'server/scraper_scheduler_cron.mjs'), 'utf8');
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    let uploaded = 0;
    const files = [
      { local: senderContent, remote: '/root/Factory/companies/Relay/server/campaign_sender.mjs', name: 'campaign_sender.mjs' },
      { local: indexContent, remote: '/root/Factory/companies/Relay/server/index.mjs', name: 'index.mjs' },
      { local: cronContent, remote: '/root/Factory/companies/Relay/server/scraper_scheduler_cron.mjs', name: 'scraper_scheduler_cron.mjs' }
    ];
    
    function uploadNext() {
      if (uploaded >= files.length) {
        // All uploaded — restart PM2 with increased memory limits
        const cmds = [
          'pm2 delete relay-backend 2>/dev/null; pm2 start /root/Factory/companies/Relay/server/index.mjs --name relay-backend --max-memory-restart 1G --node-args="--max-old-space-size=1000"',
          'pm2 restart campaign-sender',
          'pm2 restart relay-cron',
          'pm2 list'
        ].join(' && ');
        
        conn.exec(cmds, (err, stream) => {
          if (err) throw err;
          stream.on('close', () => { conn.end(); })
            .on('data', (data) => { process.stdout.write(data); })
            .stderr.on('data', (data) => { process.stderr.write(data); });
        });
        return;
      }
      
      const f = files[uploaded];
      const ws = sftp.createWriteStream(f.remote);
      ws.on('close', () => {
        console.log(`✅ Uploaded ${f.name} (${f.local.length} bytes)`);
        uploaded++;
        uploadNext();
      });
      ws.on('error', (e) => console.error(`Error uploading ${f.name}:`, e));
      ws.end(f.local);
    }
    
    uploadNext();
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: '4ULxwjLbbKxM',
  readyTimeout: 10000
});
