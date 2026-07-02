const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('du -sh /root/* /var/log/* /root/.pm2/logs/* | sort -rh | head -n 15', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { conn.end(); }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123'
});
