import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: activeSchedules, error } = await supabase
      .from('scheduled_emails')
      .select(`
          *,
          campaigns!scheduled_emails_campaign_id_fkey!inner (
              id, name, status, company_name, contact_number, primary_email
          ),
          templates!scheduled_emails_template_id_fkey!inner (*)
      `)
      .eq('status', 'scheduled')
      .eq('campaigns.status', 'in_progress');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log('Active schedules count:', activeSchedules.length);
  for (const s of activeSchedules) {
    console.log(`- Schedule ID: ${s.id}, Campaign: ${s.campaigns.name}, Template: ${s.templates.name}`);
    console.log(`  scheduled_for: ${s.scheduled_for}, end_date: ${s.end_date}`);
  }
}

test();
