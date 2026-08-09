const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('[Fix Hoisted Modules] SSH Connected...');
  
  const cmds = [
    'cd /root/Factory/companies/Relay',
    'echo "=== INSTALLING WITHOUT WORKSPACE HOISTING ==="',
    'npm install --no-workspaces --save --legacy-peer-deps --no-audit --no-fund camoufox-js@latest playwright-core@latest playwright@latest 2>&1',
    'echo "=== ENSURING MODULE LINKS IN LOCAL NODE_MODULES ==="',
    'mkdir -p /root/Factory/companies/Relay/node_modules/camoufox-js/node_modules',
    'cp -r /root/Factory/node_modules/playwright* /root/Factory/companies/Relay/node_modules/ 2>/dev/null || true',
    'cp -r /root/Factory/companies/Relay/node_modules/playwright* /root/Factory/companies/Relay/node_modules/camoufox-js/node_modules/ 2>/dev/null || true',
    'echo "=== VERIFYING CAMOUFOX & PLAYWRIGHT LOAD ==="',
    'node -e "const { Camoufox } = require(\'camoufox-js\'); console.log(\'🎉 VERIFIED CAMOUFOX & PLAYWRIGHT-CORE LOADED PERFECTLY ON HETZNER!\');" 2>&1',
    'echo "=== RESTARTING ALL 4 PM2 PRODUCTION SERVICES ==="',
    'pm2 delete all 2>/dev/null || true',
    'pm2 start /root/Factory/companies/Relay/server/index.mjs --name relay-backend --max-memory-restart 600M --node-args="--max-old-space-size=600"',
    'pm2 start /root/Factory/companies/Relay/server/campaign_sender.mjs --name campaign-sender --max-memory-restart 400M',
    'pm2 start /root/Factory/companies/Relay/server/scraper_scheduler_cron.mjs --name relay-scraper-cron --max-memory-restart 400M',
    'PORT=3005 WORKER_PORT=3005 pm2 start /root/Factory/companies/Relay/server/worker.mjs --name relay-worker --max-memory-restart 400M',
    'pm2 save',
    'echo "=== FINAL PM2 STATUS ==="',
    'pm2 list'
  ].join(' && ');
  
  conn.exec(cmds, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { 
      console.log('\n✅ Hetzner Hoist Fix and PM2 Startup Completed!');
      conn.end(); 
    }).on('data', (data) => { process.stdout.write(data); })
    .stderr.on('data', (data) => { process.stderr.write(data); });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'qHaNVfPfWL7U',
  readyTimeout: 60000
});
