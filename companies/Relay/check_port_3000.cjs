const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('lsof -i :3000 || netstat -tuln | grep 3000', (err, stream) => {
    let data = '';
    stream.on('data', d => data += d);
    stream.on('close', () => {
      console.log('--- PORT 3000 ---');
      console.log(data);
      conn.end();
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'xuLfidHVumt9'
});
