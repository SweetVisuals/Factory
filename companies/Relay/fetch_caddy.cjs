const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/caddy/Caddyfile 2>/dev/null', (err, stream) => {
    let data = '';
    stream.on('data', d => data += d);
    stream.on('close', () => {
      console.log('--- CADDYFILE ---');
      console.log(data);
      conn.end();
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'qRrgKXPaxWed'
});
