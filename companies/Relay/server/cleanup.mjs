import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // or just rely on env vars if already loaded

const supabaseUrl = 'https://db.relaysolutions.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

async function run() {
    console.log('Cleaning up invalid leads...');
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/leads?validation_status=eq.invalid`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        console.log('Response Status:', res.status, res.statusText);
        const text = await res.text();
        console.log('Response Body:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
run();
