const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/nginx/sites-enabled/*; pm2 list; ls -ld /var/www/relay; ls -ld /root/Factory/companies/Relay/dist', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'fkCJkaNmVnpW', readyTimeout: 60000 });
