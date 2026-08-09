const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const url = 'https://db.relaysolutions.net/rest/v1/leads?select=*&order=created_at.desc&limit=50';

async function run() {
  console.time('fetch leads');
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=estimated'
    }
  });
  console.timeEnd('fetch leads');
  console.log('Status:', res.status);
  
  console.time('fetch count 1');
  await fetch('https://db.relaysolutions.net/rest/v1/leads?select=*', {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'count=estimated,head=true' }
  });
  console.timeEnd('fetch count 1');

  console.time('fetch count valid');
  await fetch('https://db.relaysolutions.net/rest/v1/leads?select=*&validation_status=eq.valid', {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'count=estimated,head=true' }
  });
  console.timeEnd('fetch count valid');
}
run();
