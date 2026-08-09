const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "Killing zombies..."
    pkill -9 -f camoufox-bin || true
    echo "Restarting backend..."
    pm2 restart relay-backend
    pm2 restart relay-scraper-cron
    echo "Status:"
    pm2 list
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
