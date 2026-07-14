import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, description, status, assigned_to')
    .in('status', ['in_progress', 'pending', 'waiting']);
    
  if (error) {
    console.error('Error fetching tasks:', error.message);
  } else {
    console.log(`Found ${data.length} active tasks.`);
    data.forEach(t => console.log(`${t.id} | ${t.assigned_to} | ${t.status} | ${t.description}`));
  }
}

checkTasks();
