const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
echo "=== Cleaning Coredumps ==="
rm -rf /var/lib/apport/coredump/*

echo "=== Vacuuming Journal ==="
journalctl --vacuum-size=100M

echo "=== Cleaning Logs ==="
rm -f /root/.pm2/logs/*.log
rm -f /root/Factory/companies/Relay/*.log

echo "=== Free Space Now ==="
df -h
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
