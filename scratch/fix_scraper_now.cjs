const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected. Killing zombie camoufox processes and restarting backend...\n');
  
  const cmd = `
    echo "=== Killing zombie camoufox parent processes ==="
    # Kill the 5 zombie parent processes from Aug 1st
    ps aux | grep 'camoufox-bin -no-remote' | grep -v grep | awk '{print $2}' | while read pid; do
      echo "Killing camoufox parent PID: $pid"
      kill -9 $pid 2>/dev/null
    done

    # Give a moment for child processes to die  
    sleep 2

    # Kill any remaining camoufox child processes
    echo ""
    echo "=== Cleaning up any remaining camoufox child processes ==="
    pkill -9 -f camoufox-bin 2>/dev/null || echo "No remaining camoufox processes"

    sleep 1

    echo ""
    echo "=== Verifying no camoufox processes remain ==="
    ps aux | grep camoufox | grep -v grep || echo "All camoufox processes killed successfully"

    echo ""
    echo "=== Restarting relay-backend to reset in-memory activeScrapes counter ==="
    pm2 restart relay-backend

    sleep 3

    echo ""
    echo "=== PM2 status after restart ==="
    pm2 list

    echo ""
    echo "=== Memory after cleanup ==="
    free -m
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
