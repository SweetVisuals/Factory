const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(process.argv[2], (err, stream) => {
    stream.on('close', () => { conn.end(); })
          .on('data', d => process.stdout.write(d.toString()))
          .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'xuLfidHVumt9' });
