const { Client } = require('ssh2');

const conn = new Client();

// Clear all stale scraper tasks, then restart pm2 fresh
const COMMANDS = `
cd /root/Factory/companies/Relay

# Kill any stale scraper node processes
pm2 stop all 2>/dev/null

# Use node to clear stale tasks in the DB
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  // Clear all stale in_progress/pending scraper tasks so scheduler can start fresh for all campaigns
  const { data, error } = await client
    .from('tasks')
    .update({ status: 'completed', description: '[Cleared] Stale task reset for UK re-scrape' })
    .eq('assigned_to', 'Scraper')
    .in('status', ['in_progress', 'pending', 'waiting']);
  console.log('Cleared stale tasks:', data ? data.length : 0, error ? error.message : 'OK');
  
  // Also clear scrape history so the scheduler doesn't skip UK cities it thinks were already scraped
  const { error: histErr } = await client.from('scrape_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared scrape history:', histErr ? histErr.message : 'OK');
}
run();
"

sleep 3

# Restart everything fresh
pm2 restart all
pm2 logs --lines 20 --nostream
`;

conn.on('ready', () => {
  console.log('Connected to Hetzner');
  conn.exec(COMMANDS, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Done, exit code:', code);
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
  readyTimeout: 60000
});
