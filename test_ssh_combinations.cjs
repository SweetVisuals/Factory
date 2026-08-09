const { Client } = require('ssh2');

function tryAuth(username, password) {
  const conn = new Client();
  conn.on('ready', () => {
    console.log('SUCCESS with user:', username, 'password:', password);
    conn.end();
  }).on('error', (err) => {
    console.error('FAILED with user:', username, err.message);
  }).connect({
    host: '5.75.252.100',
    port: 22,
    username: username,
    password: password,
    readyTimeout: 10000
  });
}

tryAuth('root', '4ULxwjLbbKxM');
tryAuth('root', 'pX7RhhitWfMi');
tryAuth('root', 'fkCJkaNmVnpW');
tryAuth('root', 'UPCWbqAvcAnW');
tryAuth('root', 'mjaXRVMmbMwC7xCbcLCE');
tryAuth('root', 'mjaXRVMmbMwC7xCbcLCE123');

