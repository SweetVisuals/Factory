/**
 * Deploy the Leeds Campaign Sender to Hetzner and start it under PM2.
 * 
 * This script:
 * 1. SSHs into the Hetzner server
 * 2. Pulls latest code from GitHub
 * 3. Installs dependencies
 * 4. Starts the sender as a PM2 process
 * 
 * Run: node deploy_leeds_sender.cjs
 */
const { Client } = require('ssh2');

const HETZNER_HOST = '5.75.252.100';
const HETZNER_USER = 'root';
const HETZNER_PASS = 'mjaXRVMmbMwC7xCbcLCE123';

const DEPLOY_SCRIPT = `
set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  DEPLOYING LEEDS CAMPAIGN SENDER TO HETZNER"
echo "═══════════════════════════════════════════════════════════════"

# Navigate to project
cd /root/Factory

# Pull latest code
echo "📥 Syncing latest code with git fetch and hard reset..."
git fetch --all
git reset --hard origin/main || git reset --hard origin/master

# Navigate to Relay project
cd /root/Factory/companies/Relay

# Ensure .env exists
if [ ! -f .env ]; then
  echo "⚠️  Creating .env file..."
  cat << 'ENVEOF' > .env
SUPABASE_URL=https://fzcrjogrnujrfxafxbkh.supabase.co
SUPABASE_ANON_KEY=sb_publishable_EMXUAQk9CFJ-410K2rPYGg_UBH_TmML
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0NTg0OCwiZXhwIjoyMDk0MDIxODQ4fQ.s-ucJhIu80K2JPWBmWw7ZBkIS4P0rYd1I7KuhQXfm4U
DEEPSEEK_API_KEY=sk-b0c1833f01144c4aa6be72f5d6c72a56
PORT=3000
COMPANIES_HOUSE_API_KEY=83954dc9-09cb-4a07-808d-e0cdf0e6ec87
SERPER_API_KEY=1d48d3ecc2129e5987a23158b35c6be3109a7b9b
ENVEOF
  echo "✅ .env created"
fi

# Install dependencies (ignoring errors as dependencies are already present)
echo "📦 Installing dependencies..."
npm install --production --legacy-peer-deps 2>&1 || echo "npm install warnings ignored"

# Stop existing campaign-sender if running
echo "🔄 Stopping existing campaign-sender if running..."
pm2 delete campaign-sender 2>/dev/null || true

# Start the universal sender under PM2
echo "🚀 Starting Campaign Sender under PM2..."
pm2 start server/campaign_sender.mjs \\
  --name campaign-sender \\
  --max-restarts 3 \\
  --restart-delay 60000 \\
  --log-date-format "YYYY-MM-DD HH:mm:ss" \\
  --merge-logs \\
  --output /root/Factory/companies/Relay/campaign_sender.log \\
  --error /root/Factory/companies/Relay/campaign_sender_error.log

# Restart existing services to load the updated process_campaign_node file
echo "🔄 Reloading backend services..."
pm2 restart relay-backend 2>/dev/null || true
pm2 restart relay-cron 2>/dev/null || true

# Save PM2 config
pm2 save

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYED SUCCESSFULLY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Monitor:  pm2 logs campaign-sender"
echo "  Status:   pm2 status"
echo "  Stop:     pm2 stop campaign-sender"
echo "  Restart:  pm2 restart campaign-sender"
echo ""

# Show current PM2 status
pm2 status

# Show first few log lines
echo ""
echo "─── Initial logs ───"
sleep 3
pm2 logs campaign-sender --lines 10 --nostream 2>&1 || true
`;

console.log('🔗 Connecting to Hetzner server...');

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ SSH connected to Hetzner');
  console.log('🚀 Running deployment script...\n');

  conn.exec(DEPLOY_SCRIPT, { pty: true }, (err, stream) => {
    if (err) {
      console.error('❌ Exec error:', err.message);
      conn.end();
      return;
    }

    stream.on('close', (code, signal) => {
      console.log(`\n📋 Deployment finished (exit code: ${code})`);
      conn.end();
    });

    stream.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    stream.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
});

conn.on('error', (err) => {
  console.error('❌ SSH connection error:', err.message);
});

conn.connect({
  host: HETZNER_HOST,
  port: 22,
  username: HETZNER_USER,
  password: HETZNER_PASS,
  readyTimeout: 30000
});
