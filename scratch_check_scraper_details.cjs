const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established. Reading scraper_endpoint.log and scraper_debug.log...');
  
  const cmd = `
    echo "=== scraper_endpoint.log ==="
    tail -n 30 /root/Factory/companies/Relay/scraper_endpoint.log
    
    echo "=== scraper_debug.log ==="
    tail -n 30 /root/Factory/companies/Relay/scraper_debug.log
  `;
  
  conn.exec(cmd, (err, stream) => {
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
  password: 'fkCJkaNmVnpW'
});
