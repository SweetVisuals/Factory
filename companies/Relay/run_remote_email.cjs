const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('[Remote Emailer] Connected to Hetzner...');
  const emailScript = fs.readFileSync(path.resolve(__dirname, 'check_and_send_email.mjs'), 'utf8');
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    const remotePath = '/root/Factory/companies/Relay/check_and_send_email.mjs';
    const ws = sftp.createWriteStream(remotePath);
    ws.on('close', () => {
      console.log('✅ Uploaded check_and_send_email.mjs to Hetzner server. Executing remotely...');
      conn.exec('cd /root/Factory/companies/Relay && node check_and_send_email.mjs 2>&1', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { 
          console.log('\n[Remote Emailer] Finished remote execution.');
          conn.end(); 
        })
        .on('data', (data) => { process.stdout.write(data); })
        .stderr.on('data', (data) => { process.stderr.write(data); });
      });
    });
    ws.on('error', (e) => { console.error('SFTP upload error:', e); conn.end(); });
    ws.end(emailScript);
  });
}).on('error', (err) => {
  console.error('SSH Error:', err.message);
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW',
  readyTimeout: 30000
});
