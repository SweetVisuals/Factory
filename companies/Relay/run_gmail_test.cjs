const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const readStream = fs.createReadStream(path.resolve(__dirname, 'server/test_gmail_conn.mjs'));
    const writeStream = sftp.createWriteStream('/root/Factory/companies/Relay/server/test_gmail_conn.mjs');
    writeStream.on('close', () => {
      console.log('Test script uploaded.');
      conn.exec('node /root/Factory/companies/Relay/server/test_gmail_conn.mjs', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data);
        }).stderr.on('data', (data) => {
          process.stderr.write(data);
        });
      });
    });
    readStream.pipe(writeStream);
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 10000
});
