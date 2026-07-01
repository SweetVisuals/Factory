import dotenv from 'dotenv';
dotenv.config();
const port = process.env.PORT || 3000;
const token = process.env.SUPABASE_ANON_KEY;
fetch('http://localhost:' + port + '/api/emails?syncNew=true', {
    headers: { 'Authorization': 'Bearer ' + token }
}).then(res => res.text()).then(t => console.log(t.substring(0,200)));
