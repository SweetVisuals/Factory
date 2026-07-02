const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`cat /root/Factory/ecosystem.config.cjs 2>/dev/null || cat /root/Factory/ecosystem.config.js 2>/dev/null || cat /root/Factory/companies/Relay/ecosystem.config.cjs 2>/dev/null || pm2 prettylist | head -100`, (err, stream) => {
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
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 10000
});
