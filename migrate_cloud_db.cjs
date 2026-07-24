const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Hetzner. Running pg_dump with pooler (eu-west-1)...');
  
  const dumpCmd = `docker exec supabase-db pg_dump "postgres://postgres.lvqmlvbclglalcnfowwc:Longlonglong1!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" --clean --if-exists --schema=public --schema=storage > /tmp/cloud_dump.sql`;

  conn.exec(dumpCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Dump finished with code', code);
      if (code === 0) {
        console.log('Restoring to local db...');
        const restoreCmd = `docker exec -i supabase-db psql -U postgres -d postgres < /tmp/cloud_dump.sql`;
        conn.exec(restoreCmd, (err, stream2) => {
          stream2.on('close', (c) => {
             console.log('Restore finished with code', c);
             const restartCmd = `docker compose -f /root/supabase/docker/docker-compose.yml restart rest`;
             conn.exec(restartCmd, (err, stream3) => {
                 stream3.on('close', () => conn.end());
             });
          }).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
        });
      } else {
        conn.end();
      }
    }).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
