const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('[Install node-fetch & check logs] SSH Connected...');
  
  const cmds = [
    'cd /root/Factory/companies/Relay && npm install --save --legacy-peer-deps --no-audit --no-fund node-fetch@latest 2>&1',
    'echo "=== PM2 LOGS (SUMMARY) ==="',
    'pm2 logs relay-backend --lines 20 --nostream',
    'pm2 logs relay-scraper-cron --lines 20 --nostream'
  ].join(' && ');
  
  conn.exec(cmds, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { 
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
