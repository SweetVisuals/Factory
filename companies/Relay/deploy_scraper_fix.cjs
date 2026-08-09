/**
 * Deploy Scraper Fix
 * Uploads the patched scraper.mjs and index.mjs to Hetzner, then restarts backend.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'qRrgKXPaxWed';

const FILES_TO_UPLOAD = [
  {
    local: path.resolve(__dirname, 'server/scraper.mjs'),
    remote: '/root/Factory/companies/Relay/server/scraper.mjs'
  },
  {
    local: path.resolve(__dirname, 'server/index.mjs'),
    remote: '/root/Factory/companies/Relay/server/index.mjs'
  },
  {
    local: path.resolve(__dirname, 'server/ai-client.mjs'),
    remote: '/root/Factory/companies/Relay/server/ai-client.mjs'
  },
  {
    local: path.resolve(__dirname, 'server/research_helper.mjs'),
    remote: '/root/Factory/companies/Relay/server/research_helper.mjs'
  }
];

const conn = new Client();

console.log('Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('SSH connected.');
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err.message);
      conn.end();
      return;
    }

    console.log('Starting SFTP file uploads...');
    let completed = 0;

    function uploadNext() {
      if (completed === FILES_TO_UPLOAD.length) {
        console.log('All files uploaded. Restarting backend...');
        runPostDeployCommands();
        return;
      }

      const file = FILES_TO_UPLOAD[completed];
      console.log(`Uploading: ${path.basename(file.local)} (${(fs.statSync(file.local).size / 1024).toFixed(1)}KB)`);
      
      const readStream = fs.createReadStream(file.local);
      const writeStream = sftp.createWriteStream(file.remote);

      writeStream.on('close', () => {
        console.log(`  Done.`);
        completed++;
        uploadNext();
      });

      writeStream.on('error', (uploadErr) => {
        console.error(`Failed to upload ${file.local}:`, uploadErr.message);
        conn.end();
      });

      readStream.pipe(writeStream);
    }

    uploadNext();
  });
}).on('error', (err) => {
  console.error('Connection error:', err.message);
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'xuLfidHVumt9' // Updated Hetzner root password
});

function runPostDeployCommands() {
  const commands = `
    set -e
    cd /root/Factory/companies/Relay
    
    # Restore Crawl4AI Docker container
    echo "Starting Crawl4AI Docker container..."
    docker pull unclecode/crawl4ai:latest
    docker stop crawl4ai || true
    docker rm crawl4ai || true
    docker run -d -p 11225:11225 --name crawl4ai -e HOST=0.0.0.0 -e PORT=11225 --restart always unclecode/crawl4ai:latest
    
    # Kill any remaining zombie camoufox processes before restart
    pkill -9 -f 'camoufox-bin' 2>/dev/null || true
    sleep 1
    
    # Restart backend to load the patched code
    echo "Restarting relay-backend and relay-scraper-cron..."
    pm2 restart relay-backend
    pm2 restart relay-scraper-cron
    
    sleep 2
    pm2 status
  `;

  conn.exec(commands, (err, stream) => {
    if (err) {
      console.error('Execute error:', err.message);
      conn.end();
      return;
    }

    stream.on('close', () => {
      console.log('\nDeploy complete!');
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
