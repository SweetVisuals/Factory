const { Client } = require('ssh2');

const host = '5.75.252.100';
const username = 'root';
const password = 'fkCJkaNmVnpW';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection Ready. Searching for 2500 limit on server...');
  
  const cmd = `grep -rn "2500" /root/Factory/companies/Relay/server/ || true`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host, port: 22, username, password });
