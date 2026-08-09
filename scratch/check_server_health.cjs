const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "--- System Load & Uptime ---"
    uptime
    
    echo "\\n--- Memory ---"
    free -m
    
    echo "\\n--- Top Processes (CPU/MEM) ---"
    ps aux --sort=-%cpu | head -n 10
    
    echo "\\n--- PM2 Status ---"
    pm2 status
    
    echo "\\n--- Docker Container Status ---"
    docker stats --no-stream
    
    echo "\\n--- Backend Logs (Errors) ---"
    pm2 logs relay-backend --lines 10 --nostream
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
