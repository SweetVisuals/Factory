const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 logs relay-backend --nostream --lines 500 --timestamp', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('data', (d) => { data += d.toString(); })
          .on('close', () => { 
             const lines = data.split('\n');
             const relevant = lines.filter(l => 
                !l.includes('Realtime send()') && 
                (l.toLowerCase().includes('scrap') || l.toLowerCase().includes('research') || l.toLowerCase().includes('error'))
             );
             console.log(relevant.slice(-200).join('\n'));
             conn.end(); 
          });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'JMhMH9j4KLwk'
});
