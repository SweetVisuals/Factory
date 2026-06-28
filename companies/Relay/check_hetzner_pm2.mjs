import { Client } from 'ssh2';

const conn = new Client();

const COMMAND = `
echo "=== PM2 STATUS ==="
pm2 status
echo ""
echo "=== RELAY-CRON RECENT LOGS ==="
pm2 logs relay-cron --lines 25 --nostream
echo ""
echo "=== RELAY-BACKEND RECENT LOGS ==="
pm2 logs relay-backend --lines 25 --nostream
`;

conn.on('ready', () => {
  conn.exec(COMMAND, (err, stream) => {
    if (err) {
      console.error("SSH Exec Error:", err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error("SSH Connection Error:", err);
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 60000
});
