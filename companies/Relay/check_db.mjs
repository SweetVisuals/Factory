import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  // Get leads count
  let { count: lcount, error: lce } = await supabase.from('leads').select('*', { count: 'exact', head: true });
  if (!lce) console.log('Leads total count:', lcount);
  else console.log('Leads count error:', lce.message);

  // Get some sample leads to see columns
  let { data: sample, error: se } = await supabase.from('leads').select('*').limit(3);
  if (sample && sample.length > 0) {
    console.log('Sample lead columns:', Object.keys(sample[0]).join(', '));
    sample.forEach(l => console.log('  Lead:', JSON.stringify(l)));
  } else {
    console.log('No leads found or error:', se?.message);
  }

  // Check leads with status distribution
  if (sample && sample.length > 0) {
    let { data: statuses, error: ste } = await supabase.from('leads').select('status, campaign_id');
    if (statuses) {
      let total = statuses.length;
      let statusCount = {};
      let hasCampaign = 0;
      statuses.forEach(l => {
        statusCount[l.status] = (statusCount[l.status] || 0) + 1;
        if (l.campaign_id) hasCampaign++;
      });
      console.log('Status distribution:', JSON.stringify(statusCount));
      console.log('Leads with campaign_id:', hasCampaign, '/', total);
    }
  }

  // Check campaigns table
  let { data: campaigns, error: ce } = await supabase.from('campaigns').select('*');
  if (ce) console.log('Campaigns error:', ce.message);
  else console.log('Campaigns:', campaigns?.length || 0, JSON.stringify(campaigns?.slice(0,5)));

  // Check sequences table
  let { data: seqs, error: sqe } = await supabase.from('sequences').select('*');
  if (sqe) console.log('Sequences error:', sqe.message);
  else console.log('Sequences:', seqs?.length || 0);

  // Check email_templates
  let { data: temps, error: tme } = await supabase.from('email_templates').select('*');
  if (tme) console.log('Email templates error:', tme.message);
  else console.log('Email templates:', temps?.length || 0);
}

check().catch(console.error);
