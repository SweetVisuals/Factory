const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('[Force Install Camoufox] SSH Connected. Installing with --legacy-peer-deps to bypass peer conflicts...');
  
  const cmds = [
    'pm2 kill 2>/dev/null || true',
    'killall -9 node 2>/dev/null || true',
    'sleep 1',
    'cd /root/Factory/companies/Relay',
    'echo "=== INSTALLING DEPENDENCIES WITH --legacy-peer-deps ==="',
    'npm install --legacy-peer-deps --no-audit --no-fund 2>&1',
    'echo "=== INSTALLING CAMOUFOX-JS ==="',
    'npm install --save --legacy-peer-deps --no-audit --no-fund camoufox-js@latest 2>&1',
    'npx camoufox fetch 2>&1',
    'node -e "const { Camoufox } = require(\'camoufox-js\'); console.log(\'🎉 VERIFIED CAMOUFOX-JS LOADED SUCCESSFULLY ON HETZNER!\');"',
    'echo "=== STARTING PM2 SERVICES ==="',
    'pm2 start /root/Factory/companies/Relay/server/index.mjs --name relay-backend --max-memory-restart 1G --node-args="--max-old-space-size=1000"',
    'pm2 start /root/Factory/companies/Relay/server/campaign_sender.mjs --name campaign-sender --max-memory-restart 500M 2>/dev/null || true',
    'pm2 start /root/Factory/companies/Relay/server/cron.mjs --name relay-cron --max-memory-restart 500M 2>/dev/null || true',
    'pm2 start /root/Factory/companies/Relay/server/persona-worker.mjs --name persona-worker --max-memory-restart 500M 2>/dev/null || true',
    'pm2 save',
    'echo "=== FINAL PM2 STATUS ==="',
    'pm2 list'
  ].join(' && ');
  
  conn.exec(cmds, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { 
      console.log('\n✅ Hetzner Installation and PM2 Startup Completed!');
      conn.end(); 
    }).on('data', (data) => { process.stdout.write(data); })
    .stderr.on('data', (data) => { process.stderr.write(data); });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW',
  readyTimeout: 60000
});
