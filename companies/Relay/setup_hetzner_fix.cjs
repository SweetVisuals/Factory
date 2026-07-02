const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const script = `
    cd /root/Factory/companies/Relay
    git reset --hard
    git pull
    pm2 stop all
    pm2 delete all
    
    # Start Backend and limit to 1GB to prevent OOM
    pm2 start server/index.mjs --name relay-backend --max-memory-restart 1G
    
    # Start Cron Scheduler
    pm2 start server/scraper_scheduler_cron.mjs --name relay-cron --max-memory-restart 800M
    
    # Start Campaign Sender
    pm2 start server/campaign_sender.mjs --name campaign-sender --max-memory-restart 800M
    
    # Ensure relay-agent (AI) is removed as requested by user
    pm2 delete relay-agent || true
    
    # Save the PM2 process list so it reboots on server crash
    pm2 save
    
    # Check status
    pm2 status
  `;
  
  conn.exec(script, (err, stream) => {
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
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 10000
});
