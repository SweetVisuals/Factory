const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmds = [
    'pm2 delete relay-backend',
    'PORT=3000 pm2 start /root/Factory/companies/Relay/server/index.mjs --name relay-backend --max-memory-restart 1G --node-args="--max-old-space-size=1000"',
    'pm2 save'
  ].join(' && ');

  conn.exec(cmds, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
    .on('data', data => process.stdout.write(data))
    .stderr.on('data', data => process.stderr.write(data));
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 10000
});
