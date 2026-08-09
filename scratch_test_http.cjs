const https = require('https');
https.get('https://studio.relaysolutions.net/assets/index-IYmBQSMa.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Includes .phone property:', data.includes('.phone'));
  });
}).on('error', err => console.error(err));
