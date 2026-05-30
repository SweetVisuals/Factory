import http from 'http';

const data = JSON.stringify({
    platforms: { google: true, linkedin: false, general: false },
    business: 'restaurants',
    location: 'new york',
    limit: 5
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/scrape-leads',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Bearer DUMMY_TOKEN'
    }
}, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('Response:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
