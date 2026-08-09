const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established. Running SQL...');
  
  const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "ALTER TABLE account_settings ADD COLUMN IF NOT EXISTS show_onboarding BOOLEAN DEFAULT TRUE;"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
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
  password: 'fkCJkaNmVnpW'
});
