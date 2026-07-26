import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearEmails() {
  const { data: campaigns } = await supabase.from('campaigns').select('*');
  console.log('Campaigns found:', campaigns.length);
  
  for (const c of campaigns) {
    console.log('Campaign:', c.id, c.name, 'emails_sent:', c.emails_sent);
    if (c.emails_sent > 0) {
      await supabase.from('campaigns').update({ emails_sent: 0 }).eq('id', c.id);
      console.log('Cleared emails_sent for campaign', c.id);
    }
  }
  
  const { data: leads } = await supabase.from('campaign_leads').select('id, status').eq('status', 'emailed');
  console.log('Emailed leads:', leads ? leads.length : 0);
  
  if (leads && leads.length > 0) {
    await supabase.from('campaign_leads').update({ status: 'scraped' }).eq('status', 'emailed');
    console.log('Reset emailed leads to scraped');
  }

  const { data: userStats } = await supabase.from('account_settings').select('*');
  if (userStats) {
    for (const u of userStats) {
      console.log('User stats:', u.user_id, 'emails_sent_this_month:', u.emails_sent_this_month);
      if (u.emails_sent_this_month > 0) {
        await supabase.from('account_settings').update({ emails_sent_this_month: 0 }).eq('user_id', u.user_id);
        console.log('Cleared emails_sent_this_month for user', u.user_id);
      }
    }
  }
}
clearEmails();
