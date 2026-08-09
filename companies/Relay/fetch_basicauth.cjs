const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('find / -name "*.htpasswd" 2>/dev/null; grep -ir "auth_basic" /etc/nginx 2>/dev/null', (err, stream) => {
    let data = '';
    stream.on('data', d => data += d);
    stream.on('close', () => {
      console.log('--- AUTH FIND ---');
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
