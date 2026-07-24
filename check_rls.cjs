const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const psqlCommand = `docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"`;
  
  conn.exec(psqlCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => console.log(d.toString()))
          .stderr.on('data', d => console.error(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
