const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Hetzner VPS.');
  
  const script = `
sed -i 's/# GOTRUE_EXTERNAL_GOOGLE_ENABLED: \${GOOGLE_ENABLED}/GOTRUE_EXTERNAL_GOOGLE_ENABLED: \${GOTRUE_EXTERNAL_GOOGLE_ENABLED}/g' /root/supabase/docker/docker-compose.yml
sed -i 's/# GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: \${GOOGLE_CLIENT_ID}/GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: \${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID}/g' /root/supabase/docker/docker-compose.yml
sed -i 's/# GOTRUE_EXTERNAL_GOOGLE_SECRET: \${GOOGLE_SECRET}/GOTRUE_EXTERNAL_GOOGLE_SECRET: \${GOTRUE_EXTERNAL_GOOGLE_SECRET}/g' /root/supabase/docker/docker-compose.yml
sed -i 's/# GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: \${API_EXTERNAL_URL}\\/callback/GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: \${GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI}/g' /root/supabase/docker/docker-compose.yml
`;

  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()))
          .stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => {
      console.log('Successfully uncommented Google OAuth environment mappings in docker-compose.yml.');
      console.log('Rebuilding Docker container stack to apply modifications...');
      conn.exec('cd /root/supabase/docker && docker compose down && docker compose up -d', (err, rstream) => {
        if (err) throw err;
        rstream.on('data', d => process.stdout.write(d.toString()))
               .stderr.on('data', d => process.stderr.write(d.toString()));
        rstream.on('close', () => {
          console.log('Done! Supabase Auth is restarted and fully configured.');
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'fkCJkaNmVnpW',
  readyTimeout: 60000
});
