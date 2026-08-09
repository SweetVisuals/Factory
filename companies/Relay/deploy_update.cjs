const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
cd /root/Factory
git fetch --all
git reset --hard origin/main
cd /root/Factory/companies/Relay
npm run build
cp -r dist/* /var/www/relay-frontend/
pm2 restart all
echo "DEPLOYMENT FINISHED"
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(SETUP_SCRIPT, (err, stream) => {
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
  password: 'JMhMH9j4KLwk',
  readyTimeout: 60000
});
