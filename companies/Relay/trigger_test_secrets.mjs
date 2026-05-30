import fetch from 'node-fetch';

async function test() {
  const url = 'https://fzcrjogrnujrfxafxbkh.supabase.co/functions/v1/test-secrets';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Secrets Output:', body);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
