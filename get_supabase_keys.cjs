const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
cd /root/supabase/docker
cat .env | grep -E "^(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET)="
`;

conn.on('ready', () => {
  conn.exec(SETUP_SCRIPT, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('---KEYS---');
      console.log(output);
      conn.end();
    }).on('data', (data) => {
      output += data.toString();
    }).stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'UPCWbqAvcAnW',
  readyTimeout: 60000
});
