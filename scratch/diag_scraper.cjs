const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected. Running diagnostics...\n');
  
  const cmd = `
    echo "=== DISK SPACE ==="
    df -h /
    echo ""
    echo "=== MEMORY ==="
    free -m
    echo ""
    echo "=== LAST 80 LINES OF scraper_debug.log ==="
    tail -n 80 /root/Factory/companies/Relay/scraper_debug.log
    echo ""
    echo "=== LAST 80 LINES OF scraper_endpoint.log ==="
    tail -n 80 /root/Factory/companies/Relay/scraper_endpoint.log
    echo ""
    echo "=== PM2 LOGS relay-scraper-cron (last 80) ==="
    pm2 logs relay-scraper-cron --lines 80 --nostream 2>&1
    echo ""
    echo "=== PM2 LOGS relay-backend (last 50) ==="
    pm2 logs relay-backend --lines 50 --nostream 2>&1
    echo ""
    echo "=== TASKS TABLE - stuck tasks ==="
    PGPASSWORD=Relay2025! psql -U postgres -d postgres -h localhost -p 5432 -c "SELECT id, assigned_to, status, description, created_at FROM tasks WHERE assigned_to='Scraper' AND status IN ('in_progress','pending','waiting') ORDER BY created_at DESC LIMIT 10;" 2>/dev/null || echo "DB query skipped"
    echo ""
    echo "=== Check if Chromium/camoufox processes exist ==="
    ps aux | grep -i -E 'chrom|firefox|camoufox' | grep -v grep || echo "No browser processes found"
  `;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data))
      .stderr.on('data', (data) => process.stderr.write(data));
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW'
});
