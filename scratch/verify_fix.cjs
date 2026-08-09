const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== PM2 STATUS ==="
    pm2 list
    
    echo ""
    echo "=== safeBrowserClose count ==="
    grep -c "safeBrowserClose" /root/Factory/companies/Relay/server/scraper.mjs
    
    echo ""
    echo "=== Self-heal count ==="
    grep -c "Self-Heal" /root/Factory/companies/Relay/server/index.mjs
    
    echo ""
    echo "=== Latest scraper logs ==="
    tail -n 20 /root/.pm2/logs/relay-backend-out.log 2>/dev/null
  `;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data))
      .stderr.on('data', (data) => process.stderr.write(data));
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW'
});
