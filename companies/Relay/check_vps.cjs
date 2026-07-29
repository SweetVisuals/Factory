const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  // Check PM2 status, memory, and logs
  conn.exec('pm2 status && pm2 logs relay-backend --lines 100 --nostream', (err, stream) => {
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
