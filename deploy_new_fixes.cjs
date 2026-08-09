const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '5.75.252.100';
const username = 'root';
const password = 'qHaNVfPfWL7U';

const filesToUpload = [
  'server/index.mjs',
  'server/research_cron.mjs',
  'server/process_campaign_node.mjs',
  'server/research_helper.mjs',
  'server/execution_queue.mjs',
  'server/scraper.mjs',
  'server/ai-client.mjs',
  'server/worker.mjs',
  'check_ram_and_start.cjs'
];

console.log('Uploading fixes to Hetzner...');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    let uploadedCount = 0;
    
    filesToUpload.forEach(file => {
      const localPath = path.join(__dirname, 'companies', 'Relay', file);
      const remotePath = `/root/Factory/companies/Relay/${file}`;
      
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          console.error(`Failed to upload ${file}:`, err);
        } else {
          console.log(`Uploaded ${file}`);
        }
        
        uploadedCount++;
        if (uploadedCount === filesToUpload.length) {
          console.log('Upload complete. Re-initializing services cleanly on Hetzner...');
          
          const extractScript = `
            node /root/Factory/companies/Relay/check_ram_and_start.cjs
          `;
          
          conn.exec(extractScript, (err, stream) => {
            if (err) throw err;
            stream.on('close', () => {
                console.log('Backend services restarted cleanly.');
                conn.end();
            }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
          });
        }
      });
    });
  });
}).connect({ host, port: 22, username, password, readyTimeout: 60000 });
