import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    const { data: campaigns } = await supabase.from('campaigns').select('id, name, status');
    console.log('Campaigns:', campaigns);

    const { data: schedules } = await supabase.from('scheduled_emails').select('id, campaign_id, status');
    console.log('Schedules:', schedules);

    const { data: progress } = await supabase.from('campaign_progress').select('id, status, lead_id').limit(5);
    console.log('Recent Progress:', progress);
}

checkData();
