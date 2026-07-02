const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
apt install -y debian-keyring debian-archive-keyring apt-transport-https && \\
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes && \\
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && \\
apt update && \\
apt install -y caddy && \\
echo '5-75-252-100.nip.io {
    reverse_proxy localhost:3000
}' > /etc/caddy/Caddyfile && \\
systemctl restart caddy
`;
  console.log("Running command on server...");
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { console.log('Done'); conn.end(); }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123'
});
