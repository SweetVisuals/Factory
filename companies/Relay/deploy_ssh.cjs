const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('cd /root/Factory/companies/Relay && git fetch origin main && git reset --hard origin/main && pm2 stop all && rm -rf node_modules && npm install && npm run build && rm -rf /var/www/relay-frontend/* && cp -rf dist/* /var/www/relay-frontend/ && chown -R www-data:www-data /var/www/relay-frontend && pm2 start all', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: '4ULxwjLbbKxM'
});
