const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
echo "=== Top 15 Largest Directories ==="
du -ahx / | sort -rh | head -n 15

echo "\n=== Top PM2 Logs Size ==="
du -sh ~/.pm2/logs/* 2>/dev/null || true
du -sh /root/Factory/companies/Relay/*.log 2>/dev/null || true
`;

conn.on('ready', () => {
  conn.exec(SETUP_SCRIPT, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'UPCWbqAvcAnW',
  readyTimeout: 60000
});
