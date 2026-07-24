const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
echo "=== Top Level Directories ==="
du -sh /* 2>/dev/null | sort -rh | head -n 10

echo "\n=== Docker Size ==="
docker system df

echo "\n=== Journal Logs Size ==="
journalctl --disk-usage
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
