import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
    const leads = await supabase.from('leads').select('id').limit(5);
    console.log('Leads found:', leads.data?.length || 0);
    
    const schedules = await supabase.from('scheduled_emails').select('id, campaign_id').limit(5);
    console.log('Schedules found:', schedules.data?.length || 0);

    if (leads.data && leads.data.length > 0 && schedules.data && schedules.data.length > 0) {
        const lead = leads.data[0];
        const schedule = schedules.data[0];
        
        console.log('Testing "skipped_duplicate" status...');
        const { error } = await supabase.from('campaign_progress').upsert({
            campaign_id: schedule.campaign_id,
            schedule_id: schedule.id,
            lead_id: lead.id,
            status: 'skipped_duplicate',
            updated_at: new Date().toISOString()
        }, { onConflict: 'campaign_id,schedule_id,lead_id' });

        if (error) {
            console.log('❌ Result:', error.message);
        } else {
            console.log('✅ Status "skipped_duplicate" WORKS!');
        }
    } else {
        console.log('Cannot perform test: missing data.');
    }
}

checkTables();
