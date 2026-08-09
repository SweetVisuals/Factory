const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected');
  conn.exec('find /root /opt /etc -name "docker-compose.yml" 2>/dev/null', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', () => {
      console.log('Docker compose files:\n' + data);
      
      conn.exec('docker ps', (err2, stream2) => {
        let psData = '';
        stream2.on('data', d => psData += d);
        stream2.on('close', () => {
            console.log('Running containers:\n' + psData);
            
            // Look at Caddy/Nginx configs or Supabase Studio env
            conn.exec('cat /root/supabase/docker/.env /opt/supabase/docker/.env 2>/dev/null | grep -i "user\\|pass\\|auth\\|admin"', (err3, stream3) => {
                let envData = '';
                stream3.on('data', d => envData += d);
                stream3.on('close', () => {
                    console.log('Env contents:\n' + envData);
                    
                    conn.exec('cat $(find /root /opt /etc -name ".htpasswd" 2>/dev/null)', (err4, stream4) => {
                        let htData = '';
                        stream4.on('data', d => htData += d);
                        stream4.on('close', () => {
                            console.log('htpasswd:\n' + htData);
                            conn.end();
                        });
                    });
                });
            });
        });
      });
    }).on('data', d => {
      data += d;
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'qRrgKXPaxWed'
});
