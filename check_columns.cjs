const { Client } = require('ssh2');

const tablesToCheck = ['email_tones', 'inbox_emails'];

const conn = new Client();
conn.on('ready', () => {
  const checkCmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('${tablesToCheck.join("','")}');"`;
  
  conn.exec(checkCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => console.log(d.toString()))
          .stderr.on('data', d => console.error(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
