/**
 * Direct Deployment Script (Bypasses GitHub)
 * 
 * Uploads updated campaign files directly to the Hetzner server over SFTP,
 * then restarts PM2 services.
 * 
 * Run: node deploy_direct.cjs
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'mjaXRVMmbMwC7xCbcLCE123';

const FILES_TO_UPLOAD = [
  {
    local: path.resolve(__dirname, 'server/process_campaign_node.mjs'),
    remote: '/root/Factory/companies/Relay/server/process_campaign_node.mjs'
  },
  {
    local: path.resolve(__dirname, 'server/campaign_sender.mjs'),
    remote: '/root/Factory/companies/Relay/server/campaign_sender.mjs'
  },
  {
    local: path.resolve(__dirname, 'draft_all_campaigns.mjs'),
    remote: '/root/Factory/companies/Relay/draft_all_campaigns.mjs'
  },
  {
    local: path.resolve(__dirname, 'supabase/functions/process-campaign/index.ts'),
    remote: '/root/Factory/companies/Relay/supabase/functions/process-campaign/index.ts'
  },
  {
    local: path.resolve(__dirname, 'smtp_port_test.mjs'),
    remote: '/root/Factory/companies/Relay/smtp_port_test.mjs'
  }
];

const conn = new Client();

console.log('🔗 Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('✅ SSH connected.');
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ SFTP error:', err.message);
      conn.end();
      return;
    }

    console.log('🚀 Starting SFTP file uploads...');
    let completed = 0;

    function uploadNext() {
      if (completed === FILES_TO_UPLOAD.length) {
        console.log('✅ All files uploaded successfully.');
        runPostDeployCommands();
        return;
      }

      const file = FILES_TO_UPLOAD[completed];
      console.log(`📤 Uploading: ${path.basename(file.local)}`);
      
      const readStream = fs.createReadStream(file.local);
      const writeStream = sftp.createWriteStream(file.remote);

      writeStream.on('close', () => {
        console.log(`  Done.`);
        completed++;
        uploadNext();
      });

      writeStream.on('error', (uploadErr) => {
        console.error(`❌ Failed to upload ${file.local}:`, uploadErr.message);
        conn.end();
      });

      readStream.pipe(writeStream);
    }

    uploadNext();
  });
}).on('error', (err) => {
  console.error('❌ Connection error:', err.message);
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 30000
});

function runPostDeployCommands() {
  console.log('🔄 Executing PM2 commands on server...');
  
  const commands = `
    set -e
    cd /root/Factory/companies/Relay
    
    # Test SMTP connections
    echo "🔍 Testing SMTP ports on server..."
    node smtp_port_test.mjs || true
    
    # Restart the campaign sender process
    echo "🚀 Restarting Campaign Sender under PM2..."
    pm2 delete campaign-sender 2>/dev/null || true
    pm2 start server/campaign_sender.mjs \\
      --name campaign-sender \\
      --max-restarts 3 \\
      --restart-delay 60000 \\
      --log-date-format "YYYY-MM-DD HH:mm:ss" \\
      --merge-logs \\
      --output /root/Factory/companies/Relay/campaign_sender.log \\
      --error /root/Factory/companies/Relay/campaign_sender_error.log
      
    # Restart backend services to load updated fallback engine
    echo "🔄 Reloading core backend services..."
    pm2 restart relay-backend 2>/dev/null || true
    pm2 restart relay-cron 2>/dev/null || true
    
    pm2 save
    pm2 status
  `;

  conn.exec(commands, { pty: true }, (err, stream) => {
    if (err) {
      console.error('❌ Execute error:', err.message);
      conn.end();
      return;
    }

    stream.on('close', () => {
      console.log('\n🎉 Direct deployment complete!');
      conn.end();
    });

    stream.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    stream.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}
