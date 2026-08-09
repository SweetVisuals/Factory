const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('[Deploy & Clean] SSH Client Connected to Hetzner...');
  
  const scraperContent = fs.readFileSync(path.resolve(__dirname, 'server/scraper.mjs'), 'utf8');
  const indexContent = fs.readFileSync(path.resolve(__dirname, 'server/index.mjs'), 'utf8');
  const cleanupContent = fs.readFileSync(path.resolve(__dirname, 'server/clear_bad_leads.mjs'), 'utf8');
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    let uploaded = 0;
    const files = [
      { local: scraperContent, remote: '/root/Factory/companies/Relay/server/scraper.mjs', name: 'scraper.mjs' },
      { local: indexContent, remote: '/root/Factory/companies/Relay/server/index.mjs', name: 'index.mjs' },
      { local: cleanupContent, remote: '/root/Factory/companies/Relay/server/clear_bad_leads.mjs', name: 'clear_bad_leads.mjs' }
    ];
    
    function uploadNext() {
      if (uploaded >= files.length) {
        console.log('\n[Deploy & Clean] All code uploaded successfully! Stopping PM2 to free RAM for npm install...');
        const cmds = [
          'pm2 stop all 2>/dev/null || true',
          'cd /root/Factory/companies/Relay',
          'rm -rf node_modules/.staging 2>/dev/null || true',
          'npm install --no-audit --no-fund camoufox-js@latest 2>&1',
          'npx camoufox fetch 2>&1',
          'echo "\n=== RUNNING DATABASE CLEANUP ==="',
          'node /root/Factory/companies/Relay/server/clear_bad_leads.mjs 2>&1',
          'echo "\n=== RESTARTING PM2 SERVICES ==="',
          'pm2 delete relay-backend 2>/dev/null; pm2 start /root/Factory/companies/Relay/server/index.mjs --name relay-backend --max-memory-restart 1G --node-args="--max-old-space-size=1000"',
          'pm2 restart all 2>&1',
          'pm2 list'
        ].join(' && ');
        
        conn.exec(cmds, (err, stream) => {
          if (err) throw err;
          stream.on('close', () => { 
            console.log('\n[Deploy & Clean] All operations completed successfully! Closing SSH connection.');
            conn.end(); 
          })
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
}).on('error', (err) => {
  console.error('SSH Error:', err.message);
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW',
  readyTimeout: 30000
});
