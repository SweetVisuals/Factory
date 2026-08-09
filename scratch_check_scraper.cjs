const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established. Fetching PM2 list and logs...');
  
  // Run pm2 status and then tail the logs of relay-scraper-cron and relay-worker
  conn.exec('pm2 list; echo "=== PM2 LOGS (scraper-cron) ==="; pm2 logs relay-scraper-cron --lines 20 --nostream; echo "=== PM2 LOGS (worker) ==="; pm2 logs relay-worker --lines 20 --nostream', (err, stream) => {
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
  password: 'fkCJkaNmVnpW'
});
