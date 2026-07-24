const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Hetzner. Running pg_dump...');
  
  // Dump the cloud db
  const dumpCmd = `docker exec supabase-db pg_dump "postgres://postgres:Longlonglong1!@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?options=project%3Dlvqmlvbclglalcnfowwc" --clean --if-exists --schema=public --schema=storage > /tmp/cloud_dump.sql`;

  conn.exec(dumpCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Dump finished with code', code);
      if (code !== 0) {
        // Try fallback 5432
        console.log('Trying fallback direct port 5432...');
        const fallbackCmd = `docker exec supabase-db pg_dump "postgres://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres" --clean --if-exists --schema=public --schema=storage > /tmp/cloud_dump.sql`;
        conn.exec(fallbackCmd, (err, stream2) => {
          stream2.on('close', (c) => {
             console.log('Fallback dump finished with code', c);
             conn.end();
          }).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
        });
      } else {
        conn.end();
      }
    }).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
