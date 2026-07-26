const { Client } = require('ssh2');

const conn = new Client();

const SETUP_SCRIPT = `
export DEBIAN_FRONTEND=noninteractive

echo "Checking for Docker..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
else
    echo "Docker already installed."
fi

echo "Setting up Supabase..."
if [ ! -d "/root/supabase" ]; then
    git clone https://github.com/supabase/supabase /root/supabase
fi

cd /root/supabase/docker
cp .env.example .env

# We will configure the API_EXTERNAL_URL to the server's IP for now
sed -i 's/API_EXTERNAL_URL=http:\\/\\/localhost:8000/API_EXTERNAL_URL=http:\\/\\/5.75.252.100:8000/g' .env
# Change the default postgres password for security
sed -i 's/POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password/POSTGRES_PASSWORD=Longlonglong1!/g' .env

echo "Pulling Supabase images..."
docker compose pull

echo "Starting Supabase..."
docker compose up -d

echo "Done! Supabase should be running on http://5.75.252.100:8000"
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(SETUP_SCRIPT, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
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
  password: '4ULxwjLbbKxM',
  readyTimeout: 60000
});
