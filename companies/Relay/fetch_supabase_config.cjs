const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('cat /root/supabase/docker/.env', (err, stream) => {
    let data = '';
    stream.on('data', d => data += d);
    stream.on('close', () => {
      console.log('--- SUPABASE ENV ---');
      console.log(data.split('\\n').filter(l => l.includes('DASHBOARD') || l.includes('STUDIO') || l.includes('PASS')).join('\\n'));
      conn.exec('cat /etc/nginx/.htpasswd /root/nginx/.htpasswd /opt/nginx/.htpasswd 2>/dev/null', (err2, stream2) => {
        let htData = '';
        stream2.on('data', d => htData += d);
        stream2.on('close', () => {
          console.log('--- HTPASSWD ---');
          console.log(htData);
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'qRrgKXPaxWed'
});
