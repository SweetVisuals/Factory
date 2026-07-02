const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const localFile = path.join(__dirname, 'server', 'index.mjs');
  const fileContent = fs.readFileSync(localFile);
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const remoteFile = '/root/Factory/companies/Relay/server/index.mjs';
    const writeStream = sftp.createWriteStream(remoteFile);
    
    writeStream.on('close', () => {
      console.log('File transferred successfully');
      
      conn.exec('cd /root/Factory/companies/Relay && pm2 restart relay-backend', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log('PM2 restarted');
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data);
        }).stderr.on('data', (data) => {
          process.stderr.write(data);
        });
      });
    });
    
    writeStream.write(fileContent);
    writeStream.end();
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 10000
});
