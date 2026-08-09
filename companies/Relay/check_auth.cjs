const https = require('https');
const urls = [
  'https://studio.relaysolutions.net',
  'https://data.relaysolutions.net',
  'https://db.relaysolutions.net'
];

urls.forEach(url => {
  https.get(url, res => {
    console.log(url, res.statusCode, res.headers['www-authenticate'] || 'No auth header');
  }).on('error', e => console.error(url, e.message));
});
