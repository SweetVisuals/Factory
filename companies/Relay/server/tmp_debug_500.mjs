import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testEndpoint() {
  console.log('[Debug] Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });

  if (authError) {
    console.error('Failed to auth:', authError);
    return;
  }

  const token = authData.session.access_token;
  const accountId = '339738d4-75fa-4a18-836a-b90bdec51b14'; // User's account ID

  console.log('[Debug] Hitting endpoint...');
  try {
    const res = await fetch(`http://localhost:3001/api/email-accounts/${accountId}/test-design`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        templateName: 'web',
        toEmail: 'acedkmgmt@gmail.com'
      })
    });

    const body = await res.json();
    console.log('[Debug] Response Status:', res.status);
    console.log('[Debug] Response Body:', body);
  } catch (err) {
    console.error('[Debug] Request failed:', err);
  }
}

testEndpoint();
