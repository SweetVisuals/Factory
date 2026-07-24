const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const psqlQuery = `docker exec supabase-db psql "postgres://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres" -c "\\dt public.*"`;
  conn.exec(psqlQuery, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => console.log(d.toString()))
          .stderr.on('data', d => console.error(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
