const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('Testing Longlonglong1!');
  conn.exec('docker exec supabase-db pg_dump "postgres://postgres:Longlonglong1!@db.rfvzrnbayzxibczlntcc.supabase.co:5432/postgres" --schema-only -t personas', (err, stream) => {
    stream.on('close', () => {
      console.log('Testing ColdSpark123!');
      conn.exec('docker exec supabase-db pg_dump "postgres://postgres:ColdSpark123!@db.rfvzrnbayzxibczlntcc.supabase.co:5432/postgres" --schema-only -t personas', (err2, stream2) => {
        stream2.on('close', () => conn.end()).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
      });
    }).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'xuLfidHVumt9', readyTimeout: 10000 });
