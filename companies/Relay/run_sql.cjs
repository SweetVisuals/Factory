const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const sql = fs.readFileSync('admin_rpcs_subs.sql', 'utf8');
  const cmd = `cat << 'EOF_SQL' | docker exec -i supabase-db psql -U postgres
${sql}
EOF_SQL`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: '4ULxwjLbbKxM'
});
