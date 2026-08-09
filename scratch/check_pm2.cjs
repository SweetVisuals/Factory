const { Client } = require('ssh2');

const host = '5.75.252.100';
const username = 'root';
const password = 'fkCJkaNmVnpW';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection Ready. Checking pm2 status and logs on Hetzner...');
  
  const cmd = `
    pm2 status
    echo "=== Cron Logs ==="
    pm2 logs relay-cron --lines 50 --nostream || true
    echo "=== Backend Logs ==="
    pm2 logs relay-backend --lines 50 --nostream || true
  `;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host, port: 22, username, password });
