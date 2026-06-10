const { Client } = require('ssh2');

const conn = new Client();

const DEPLOY_SCRIPT = `
cd /root/Factory/companies/Relay
git pull
pm2 restart all
pm2 logs --lines 10
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(DEPLOY_SCRIPT, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
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
  readyTimeout: 60000
});
