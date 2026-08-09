const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    docker ps
    apt-get install -y nginx certbot python3-certbot-nginx
    
    cat > /etc/nginx/sites-available/supabase << 'EOF'
server {
    listen 80;
    server_name db.relaysolutions.net;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name data.relaysolutions.net;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx
    
    certbot --nginx -d db.relaysolutions.net -d data.relaysolutions.net --non-interactive --agree-tos -m admin@relaysolutions.net
    echo "DONE NGINX AND CERTBOT"
  `;
  
  console.log('Running nginx setup...');
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
        console.log('Finished');
        conn.end();
    }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
