const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "Cleaning up NPM cache..."
    npm cache clean --force
    rm -rf /root/.npm/_cacache
    
    echo "Cleaning up old local_chrome..."
    rm -rf /root/tmp/.local_chrome
    
    echo "Compressing Supabase .git..."
    cd /root/supabase && git gc --aggressive --prune=now || true
    
    echo "--- Disk Space After Clean Up ---"
    df -h /
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data))
      .stderr.on('data', (data) => process.stderr.write(data));
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW'
});
