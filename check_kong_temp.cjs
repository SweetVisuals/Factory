const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('df -h && echo "---" && docker logs relay-studio-kong-1 --tail 50', (err, stream) => {
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'JMhMH9j4KLwk', readyTimeout: 10000 });
