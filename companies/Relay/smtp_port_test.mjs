import net from 'net';

const hosts = [
  { host: 'mail.privateemail.com', port: 465 },
  { host: 'mail.privateemail.com', port: 587 }
];

async function test(h) {
  return new Promise((resolve) => {
    console.log(`Testing ${h.host}:${h.port}...`);
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.connect(h.port, h.host, () => {
      console.log(`✅ Connected to ${h.host}:${h.port} successfully`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', (err) => {
      console.error(`❌ Connection to ${h.host}:${h.port} failed:`, err.message);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('timeout', () => {
      console.error(`❌ Connection to ${h.host}:${h.port} timed out`);
      socket.destroy();
      resolve(false);
    });
  });
}

async function run() {
  for (const h of hosts) {
    await test(h);
  }
}

run();
