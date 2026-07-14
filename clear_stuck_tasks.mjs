import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function clearTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: 'failed', description: 'Marked as failed due to zombie state' })
    .in('status', ['in_progress', 'pending', 'waiting'])
    .select();
    
  if (error) {
    console.error('Error clearing tasks:', error.message);
  } else {
    console.log(`Successfully cleared ${data.length} stuck tasks.`);
  }
}

clearTasks();
