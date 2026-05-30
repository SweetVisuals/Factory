import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyPatch() {
    console.log('Reading relay_dedup_patch.sql...');
    const query = fs.readFileSync('c:/Users/Shadow/Desktop/Openclaw Factory/relay_dedup_patch.sql', 'utf8');

    console.log('Applying DB patch via exec_sql...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: query });

    if (error) {
        console.error('Error applying patch via exec_sql:', error);
        // Try 'query' instead of 'sql' just in case
        console.log('Trying with parameter name "query"...');
        const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { query: query });
        if (error2) {
             console.error('Error applying patch via exec_sql (query):', error2);
        } else {
             console.log('Successfully applied DB patch via exec_sql (query)!');
        }
    } else {
        console.log('Successfully applied DB patch via exec_sql!');
        console.log('Result:', data);
    }
}

applyPatch();
