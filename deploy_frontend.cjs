const { Client } = require('ssh2');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const host = '5.75.252.100';
const username = 'root';
const password = 'JMhMH9j4KLwk';
const appDir = path.join(__dirname, 'companies', 'Relay');

console.log('Building the Vite frontend...');
try {
  execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
} catch (e) {
  console.error('Build failed!');
  process.exit(1);
}

console.log('Zipping the dist folder...');
try {
  // Use tar to zip the dist folder
  execSync('tar -czf dist.tar.gz -C dist .', { cwd: appDir, stdio: 'inherit' });
} catch (e) {
  console.error('Failed to create tarball!');
  process.exit(1);
}

const tarballPath = path.join(appDir, 'dist.tar.gz');

console.log('Uploading to Hetzner...');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    sftp.fastPut(tarballPath, '/tmp/dist.tar.gz', (err) => {
      if (err) throw err;
      
      console.log('Upload complete. Extracting files...');
      
      const extractScript = `
        rm -rf /var/www/relay-frontend/*
        tar -xzf /tmp/dist.tar.gz -C /var/www/relay-frontend/
        chown -R www-data:www-data /var/www/relay-frontend/
        rm /tmp/dist.tar.gz
        echo "Deployment complete!"
      `;
      
      conn.exec(extractScript, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Finished.');
            fs.unlinkSync(tarballPath);
            conn.end();
        }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
      });
    });
  });
}).connect({ host, port: 22, username, password, readyTimeout: 60000 });
