const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.shell((err, stream) => {
    if (err) throw err;
    let step = 0;
    stream.on('close', () => {
      console.log('Stream :: close');
      conn.end();
    }).on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      
      if (output.includes('Current password:')) {
        stream.write('mjaXRVMmbMwC7xCbcLCE\n');
      } else if (output.includes('New password:')) {
        stream.write('mjaXRVMmbMwC7xCbcLCE123\n');
      } else if (output.includes('Retype new password:')) {
        stream.write('mjaXRVMmbMwC7xCbcLCE123\n');
      } else if (output.includes('root@')) {
        if (step === 0) {
          step = 1;
          console.log('--- PASSWORD CHANGED. RUNNING SETUP ---');
          stream.write(`
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
npm install -g pm2

git clone https://github.com/SweetVisuals/Factory.git /root/Factory

cat << 'EOF' > /root/Factory/companies/Relay/.env
SUPABASE_URL=https://fzcrjogrnujrfxafxbkh.supabase.co
SUPABASE_ANON_KEY=sb_publishable_EMXUAQk9CFJ-410K2rPYGg_UBH_TmML
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0NTg0OCwiZXhwIjoyMDk0MDIxODQ4fQ.s-ucJhIu80K2JPWBmWw7ZBkIS4P0rYd1I7KuhQXfm4U
GEMINI_API_KEY=sk-b0c1833f01144c4aa6be72f5d6c72a56
PORT=3000
COMPANIES_HOUSE_API_KEY=83954dc9-09cb-4a07-808d-e0cdf0e6ec87
SERPER_API_KEY=1d48d3ecc2129e5987a23158b35c6be3109a7b9b
EOF

cd /root/Factory/companies/Relay
npm install

pm2 start server/index.mjs --name relay-backend
pm2 start server/scraper_scheduler_cron.mjs --name relay-cron
pm2 save
pm2 startup
exit
          `);
        }
      }
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE',
  readyTimeout: 60000
});
