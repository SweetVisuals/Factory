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

tryAuth('ubuntu', '4ULxwjLbbKxM');
tryAuth('ubuntu', 'pX7RhhitWfMi');
tryAuth('ubuntu', 'fkCJkaNmVnpW');
tryAuth('ubuntu', 'UPCWbqAvcAnW');
tryAuth('ubuntu', 'mjaXRVMmbMwC7xCbcLCE');
tryAuth('ubuntu', 'mjaXRVMmbMwC7xCbcLCE123');

