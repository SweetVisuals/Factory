const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    cd /root/supabase/docker
    sed -i 's/DASHBOARD_PASSWORD=.*/DASHBOARD_PASSWORD=Longlonglong1!/g' .env
    docker compose up -d studio
  `;
  
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
        console.log('Finished updating password');
        conn.end();
    }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
