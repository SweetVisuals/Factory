import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    return;
  }
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const { data: tasks, error } = await client.from('tasks')
    .select('id, assigned_to, status, description, progress, result, created_at')
    .in('status', ['pending', 'in_progress', 'waiting'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error.message);
    return;
  }

  console.log(`--- ACTIVE/PENDING TASKS (${tasks.length}) ---`);
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id}`);
    console.log(`Agent: ${t.assigned_to}`);
    console.log(`Status: ${t.status}`);
    console.log(`Created: ${t.created_at}`);
    console.log(`Description: ${t.description.substring(0, 150)}...`);
    console.log(`Result: ${t.result ? t.result.substring(0, 100) : 'none'}`);
    console.log('---------------------------------------------');
  });
}

main().catch(console.error);
