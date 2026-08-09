const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
echo "=== Checking /root/.cache ==="
du -sh /root/.cache 2>/dev/null

echo "=== Checking /root/.npm ==="
du -sh /root/.npm 2>/dev/null

echo "=== Checking /root/Factory ==="
du -sh /root/Factory 2>/dev/null

echo "=== Checking Supabase Volumes ==="
du -sh /root/supabase/docker/volumes 2>/dev/null
du -sh /root/supabase 2>/dev/null

echo "=== Top 10 Largest Files in / ==="
find / -xdev -type f -size +100M -exec ls -lh {} + 2>/dev/null | sort -k 5 -rh | head -n 10
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
