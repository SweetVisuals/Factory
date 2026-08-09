const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        console.log('Uploading worker.tar.gz...');
        const readStream = fs.createReadStream('C:\\\\Users\\\\Shadow\\\\Desktop\\\\persona-hub\\\\worker.tar.gz');
        const writeStream = sftp.createWriteStream('/root/worker.tar.gz');
        
        writeStream.on('close', () => {
            console.log('File transferred successfully.');
            sftp.end();
            
            const commands = `
                echo "Extracting worker..."
                tar -xzf /root/worker.tar.gz -C /root
                cd /root/worker
                
                echo "Setting up .env..."
                cat << 'EOF' > .env
SUPABASE_URL=http://5.75.252.100:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
EOF
                
                echo "Installing node modules..."
                npm install
                
                echo "Starting with PM2..."
                # Delete existing if it exists
                pm2 delete persona-worker || true
                pm2 start index.js --name persona-worker
                pm2 save
            `;
            
            conn.exec(commands, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log('Commands executed with code ' + code);
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
    password: 'xuLfidHVumt9',
    readyTimeout: 30000
});
