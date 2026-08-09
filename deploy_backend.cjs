const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '5.75.252.100';
const username = 'root';
const password = 'JMhMH9j4KLwk';
const appDir = path.join(__dirname, 'companies', 'Relay');

console.log('Uploading scraper backend to Hetzner...');
const conn = new Client();

const filesToUpload = [
    { local: path.join(appDir, 'server', 'scraper.mjs'), remote: '/root/Factory/companies/Relay/server/scraper.mjs' },
    { local: path.join(appDir, 'server', 'index.mjs'), remote: '/root/Factory/companies/Relay/server/index.mjs' },
    { local: path.join(appDir, 'server', 'scraper_scheduler_cron.mjs'), remote: '/root/Factory/companies/Relay/server/scraper_scheduler_cron.mjs' },
    { local: path.join(appDir, 'server', 'scraper_tools.mjs'), remote: '/root/Factory/companies/Relay/server/scraper_tools.mjs' },
    { local: path.join(appDir, 'server', 'research_helper.mjs'), remote: '/root/Factory/companies/Relay/server/research_helper.mjs' },
    { local: path.join(appDir, 'server', 'execution_queue.mjs'), remote: '/root/Factory/companies/Relay/server/execution_queue.mjs' },
    { local: path.join(appDir, 'server', 'ai-client.mjs'), remote: '/root/Factory/companies/Relay/server/ai-client.mjs' },
    { local: path.join(appDir, 'server', 'reputation_cron.mjs'), remote: '/root/Factory/companies/Relay/server/reputation_cron.mjs' },
    { local: path.join(appDir, 'server', 'blast_reputation.mjs'), remote: '/root/Factory/companies/Relay/server/blast_reputation.mjs' }
];

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    let uploaded = 0;
    
    filesToUpload.forEach(file => {
        sftp.fastPut(file.local, file.remote, (err) => {
            if (err) throw err;
            console.log(`Uploaded ${file.local} to ${file.remote}`);
            uploaded++;
            
            if (uploaded === filesToUpload.length) {
                console.log('Uploads complete. Running install and restarting PM2...');
                
                const extractScript = `
                  cd /root/Factory/companies/Relay
                  cd /root/Factory/companies/Relay/server
                  npm install --legacy-peer-deps && pkill -f camoufox || true
                  pm2 restart relay-scraper-cron || true
                  pm2 restart relay-reputation-cron || true
                  pm2 restart relay-backend || true
                `;
                
                conn.exec(extractScript, (err, stream) => {
                  if (err) throw err;
                  stream.on('close', () => {
                      console.log('Backend restarted.');
                      conn.end();
                  }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
                });
            }
        });
    });
  });
}).connect({ host, port: 22, username, password, readyTimeout: 60000 });
