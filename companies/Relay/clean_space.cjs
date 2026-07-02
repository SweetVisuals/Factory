const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
rm -rf /root/Factory/companies/Relay/tmp/.local_chrome/puppeteer*
pm2 flush
apt-get clean
`;
  console.log("Cleaning up space...");
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { console.log('Done'); conn.end(); }).on('data', (data) => {
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
