const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "Stopping Crawl4AI to free up memory..."
    docker stop crawl4ai
    
    echo "Restarting Supabase database..."
    docker restart supabase-db
    docker restart supabase-rest
    docker restart supabase-auth
    
    echo "Checking status..."
    docker ps | grep -E "crawl4ai|supabase-db|supabase-rest|supabase-auth"
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
