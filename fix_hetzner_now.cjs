const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
echo "=== Disk Space Before ==="
df -h

echo "=== Cleaning PM2 Logs ==="
pm2 flush

echo "=== Cleaning Docker ==="
docker system prune -af --volumes

echo "=== Cleaning Journal Logs ==="
journalctl --vacuum-time=1d
journalctl --vacuum-size=100M

echo "=== Deleting old temp profiles ==="
rm -rf /root/Factory/companies/Relay/tmp/*
rm -rf /root/Factory/companies/Relay/scraper_debug.log
rm -rf /root/Factory/companies/Relay/scraper_endpoint.log

echo "=== Restarting Docker Containers (Supabase) ==="
cd /root/Factory/supabase || cd /root/supabase || echo "Cannot find supabase dir, skipping docker restart"
# Let's just restart all running docker containers
docker restart $(docker ps -q) || true

echo "=== Disk Space After ==="
df -h
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(SETUP_SCRIPT, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
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
  password: 'fkCJkaNmVnpW',
  readyTimeout: 60000
});
