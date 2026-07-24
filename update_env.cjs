const fs = require('fs');

const envPath = 'C:\\Users\\Shadow\\Desktop\\Factory\\companies\\Relay\\.env';
let env = fs.readFileSync(envPath, 'utf8');

const URL = 'http://5.75.252.100:8000';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

env = env.replace(/SUPABASE_URL=.*/g, 'SUPABASE_URL=' + URL);
env = env.replace(/SUPABASE_ANON_KEY=.*/g, 'SUPABASE_ANON_KEY=' + ANON);
env = env.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/g, 'SUPABASE_SERVICE_ROLE_KEY=' + SERVICE);

env = env.replace(/VITE_SUPABASE_URL=.*/g, 'VITE_SUPABASE_URL=' + URL);
env = env.replace(/VITE_SUPABASE_ANON_KEY=.*/g, 'VITE_SUPABASE_ANON_KEY=' + ANON);
env = env.replace(/VITE_SUPABASE_PUBLISHABLE_KEY=.*/g, 'VITE_SUPABASE_PUBLISHABLE_KEY=' + ANON);

env = env.replace(/VITE_HQ_SUPABASE_URL=.*/g, 'VITE_HQ_SUPABASE_URL=' + URL);
env = env.replace(/VITE_HQ_SUPABASE_ANON_KEY=.*/g, 'VITE_HQ_SUPABASE_ANON_KEY=' + ANON);

env = env.replace(/VITE_OPENCLAW_SUPABASE_URL=.*/g, 'VITE_OPENCLAW_SUPABASE_URL=' + URL);
env = env.replace(/VITE_OPENCLAW_ANON_KEY=.*/g, 'VITE_OPENCLAW_ANON_KEY=' + ANON);

fs.writeFileSync(envPath, env);
console.log('Updated local .env');
