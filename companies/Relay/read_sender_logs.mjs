import { Client } from 'ssh2';

const conn = new Client();

const COMMAND = `
echo "=== CAMPAIGN SENDER LOGS ==="
tail -n 50 /root/Factory/companies/Relay/campaign_sender.log || echo "No out log"
echo ""
echo "=== CAMPAIGN SENDER ERRORS ==="
tail -n 50 /root/Factory/companies/Relay/campaign_sender_error.log || echo "No error log"
`;

conn.on('ready', () => {
  conn.exec(COMMAND, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => {
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
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 30000
});
