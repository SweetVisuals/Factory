const { Client } = require('ssh2');

const host = '5.75.252.100';
const username = 'root';
const password = 'fkCJkaNmVnpW';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection Ready. Updating /root/supabase/docker/.env with production domain and restarting auth...');
  
  const script = `
    # Backup (if not exists)
    [ ! -f /root/supabase/docker/.env.bak ] && cp /root/supabase/docker/.env /root/supabase/docker/.env.bak
    
    # Update SITE_URL
    sed -i 's|^SITE_URL=.*|SITE_URL=https://studio.relaysolutions.net|g' /root/supabase/docker/.env
    
    # Update ADDITIONAL_REDIRECT_URLS
    sed -i 's|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=https://studio.relaysolutions.net/auth/verify,http://localhost:5173/auth/verify,http://localhost:5174/auth/verify,http://localhost:3000/auth/verify|g' /root/supabase/docker/.env
    
    # Print new lines to verify
    grep -E "^(SITE_URL|ADDITIONAL_REDIRECT_URLS)=" /root/supabase/docker/.env
    
    # Restart Supabase auth container
    cd /root/supabase/docker
    docker compose down auth
    docker compose up -d auth
    
    echo "Done restart auth!"
  `;
  
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host, port: 22, username, password });
