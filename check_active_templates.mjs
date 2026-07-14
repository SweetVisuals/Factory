import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Get active campaigns with their scheduled_emails -> templates
  const { data: schedules } = await supabase
    .from('scheduled_emails')
    .select('id, campaign_id, campaigns!inner(id, name, status), templates!inner(id, name, subject, content)')
    .in('campaigns.status', ['active', 'in_progress'])
    .limit(10);
    
  for (const s of (schedules || [])) {
    console.log(`\n═══ Campaign: ${s.campaigns.name} ═══`);
    console.log(`Template: ${s.templates.name}`);
    console.log(`Subject: ${s.templates.subject}`);
    console.log(`Content:\n${s.templates.content}\n`);
  }
}

check();
