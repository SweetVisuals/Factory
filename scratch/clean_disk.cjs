const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "Removing crawl4ai container and image to free disk space..."
    docker rm -f crawl4ai
    docker rmi -f unclecode/crawl4ai:latest
    
    echo "Pruning dangling images..."
    docker image prune -f
    
    echo "Restarting Supabase database..."
    docker restart supabase-db
    docker restart supabase-rest
    docker restart supabase-auth
    
    echo "--- Disk Space After ---"
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
