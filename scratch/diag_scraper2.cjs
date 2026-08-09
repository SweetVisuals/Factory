const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== FULL scraper_endpoint.log TAIL (last 80) ==="
    tail -n 80 /root/Factory/companies/Relay/scraper_endpoint.log

    echo ""
    echo "=== relay-backend PM2 error logs (last 100) ==="
    tail -n 100 /root/.pm2/logs/relay-backend-error.log 2>/dev/null || echo "No error log"

    echo ""
    echo "=== relay-backend PM2 out logs - scraper related (last 200, filtered) ==="
    tail -n 200 /root/.pm2/logs/relay-backend-out.log 2>/dev/null | grep -i -E 'scraper|scrape|browser|camoufox|OOM|kill|error|fail|crash' || echo "No scraper-related entries"

    echo ""
    echo "=== Check tasks table in Supabase for stuck scraper tasks ==="
    cd /root/Factory/companies/Relay && node -e "
      import('@supabase/supabase-js').then(({createClient}) => {
        const fs = require('fs');
        const env = fs.readFileSync('.env','utf8');
        const url = env.match(/SUPABASE_URL=(.+)/)?.[1]?.trim();
        const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
        const sb = createClient(url, key);
        sb.from('tasks').select('id, assigned_to, status, description, created_at').eq('assigned_to','Scraper').in('status',['in_progress','pending','waiting']).order('created_at',{ascending:false}).limit(10).then(({data, error}) => {
          if (error) console.log('DB Error:', error.message);
          else console.log('Stuck scraper tasks:', JSON.stringify(data, null, 2));
        });
      });
    " 2>&1

    echo ""
    echo "=== Count of zombie camoufox parent processes ==="
    ps aux | grep 'camoufox-bin -no-remote' | grep -v grep | wc -l

    echo ""
    echo "=== Ages of zombie camoufox parent processes ==="
    ps -eo pid,lstart,cmd | grep 'camoufox-bin -no-remote' | grep -v grep
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
