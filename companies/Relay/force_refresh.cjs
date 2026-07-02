const { Client } = require('ssh2');

const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'mjaXRVMmbMwC7xCbcLCE123';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected. Executing curl...');
  conn.exec(`
    cd /root/Factory/companies/Relay
    source .env
    curl "http://localhost:3000/api/emails?refresh=true" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  `, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('Done.');
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 30000
});
