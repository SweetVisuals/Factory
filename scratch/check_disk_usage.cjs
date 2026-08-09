const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "--- Docker System DF ---"
    docker system df
    
    echo "\\n--- Top 10 Largest Directories in / ---"
    du -h -x -d 1 / | sort -hr | head -n 10
    
    echo "\\n--- Top Largest Directories in /var/lib/docker ---"
    du -h -x -d 1 /var/lib/docker | sort -hr | head -n 10
    
    echo "\\n--- PM2 Logs Size ---"
    du -sh ~/.pm2/logs
    
    echo "\\n--- Database Size (Docker volumes) ---"
    du -sh /var/lib/docker/volumes/* | sort -hr | head -n 5
    
    echo "\\n--- Checking for large log files in /var/lib/docker/containers ---"
    find /var/lib/docker/containers -type f -name "*.log" -exec ls -lh {} + | awk '{print $5, $9}' | sort -hr | head -n 10
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
