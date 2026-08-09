const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('[Fix Hetzner Scraper] SSH Connected. Cleaning corrupted node_modules packages...');
  
  const scraperContent = fs.readFileSync(path.resolve(__dirname, 'server/scraper.mjs'), 'utf8');
  const indexContent = fs.readFileSync(path.resolve(__dirname, 'server/index.mjs'), 'utf8');
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    let uploaded = 0;
    const files = [
      { local: scraperContent, remote: '/root/Factory/companies/Relay/server/scraper.mjs', name: 'scraper.mjs' },
      { local: indexContent, remote: '/root/Factory/companies/Relay/server/index.mjs', name: 'index.mjs' }
    ];
    
    function uploadNext() {
      if (uploaded >= files.length) {
        console.log('\n[Fix Hetzner Scraper] Uploads complete. Reinstalling camoufox-js cleanly...');
        const cmds = [
          'pm2 stop all 2>/dev/null || true',
          'cd /root/Factory/companies/Relay',
          'rm -rf node_modules/camoufox* node_modules/.camoufox* node_modules/.staging 2>/dev/null || true',
          'npm install --save --no-audit --no-fund camoufox-js@latest 2>&1',
          'npx camoufox fetch 2>&1',
          'node -e "const { Camoufox } = require(\'camoufox-js\'); console.log(\'✅ Camoufox verified installed successfully on Hetzner!\');"',
          'pm2 delete relay-backend 2>/dev/null || true',
          'pm2 start /root/Factory/companies/Relay/server/index.mjs --name relay-backend --max-memory-restart 1G --node-args="--max-old-space-size=1000"',
          'pm2 start all 2>/dev/null || true',
          'pm2 save',
          'echo "=== PM2 STATUS ==="',
          'pm2 list'
        ].join(' && ');
        
        conn.exec(cmds, (err, stream) => {
          if (err) throw err;
          stream.on('close', () => { 
            console.log('\n✅ Hetzner Scraper Engine Repaired and Restarted cleanly!');
            conn.end(); 
          }).on('data', (data) => { process.stdout.write(data); })
          .stderr.on('data', (data) => { process.stderr.write(data); });
        });
        return;
      }
      
      const f = files[uploaded];
      const ws = sftp.createWriteStream(f.remote);
      ws.on('close', () => {
        console.log(`✅ Uploaded ${f.name}`);
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
  password: 'fkCJkaNmVnpW',
  readyTimeout: 30000
});
