const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    mkdir -p /var/www/relay-frontend
    chown -R www-data:www-data /var/www/relay-frontend
    
    cat > /etc/nginx/sites-available/frontend << 'EOF'
server {
    listen 80;
    server_name studio.relaysolutions.net;

    root /var/www/relay-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
    nginx -t
    systemctl restart nginx
    
    certbot --nginx -d studio.relaysolutions.net --non-interactive --agree-tos -m admin@relaysolutions.net
    echo "DONE FRONTEND NGINX"
  `;
  
  console.log('Running frontend nginx setup...');
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
        console.log('Finished');
        conn.end();
    }).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
