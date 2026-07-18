import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvqmlvbclglalcnfowwc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cW1sdmJjbGdsYWxjbmZvd3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxNTMsImV4cCI6MjA5OTU4OTE1M30.PHOdd5mlqBN3RAdz2w0ye64fBgDXAa7e8kto28pzIuU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Login as the user
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (authError || !user) { console.log('Auth failed:', authError?.message); return; }
  console.log('Logged in as:', user.user.id);
  
  const authedSupabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: 'Bearer ' + user.session.access_token } }
  });
  
  // 2. Fetch campaigns as the frontend does (filtered by user_id)
  let { data: camps } = await authedSupabase.from('campaigns').select('*').eq('user_id', user.user.id);
  console.log("\n=== CAMPAIGNS (authed as user) ===");
  console.log('Count:', camps?.length);
  camps?.forEach(c => console.log(`  ${c.name}: prospects=${c.prospects}, replies=${c.replies}, status=${c.status}`));
  
  // 3. Also check without user filter (admin)
  let { data: allCamps } = await supabase.from('campaigns').select('*');
  console.log("\n=== CAMPAIGNS (admin - no user filter) ===");
  allCamps?.forEach(c => console.log(`  ${c.name}: user_id=${c.user_id}, prospects=${c.prospects}`));
  
  // 4. Check campaign leads counts
  for (const camp of (allCamps || [])) {
    let { count } = await supabase.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.id);
    console.log(`  campaign_leads for ${camp.name}: ${count}`);
  }
  
  // 5. Discover page query - replicate exactly
  let query = authedSupabase.from('leads').select('id, name, email, company', { count: 'exact' });
  query = query.neq('validation_status', 'invalid');
  query = query.neq('status', 'bounced');
  
  let { data: leads, count, error } = await query.order('created_at', { ascending: false }).limit(5);
  console.log("\n=== DISCOVER PAGE QUERY RESULTS ===");
  console.log('Count:', count, 'Error:', error?.message);
  if (leads) console.log('Sample:', JSON.stringify(leads, null, 2));
  
  // 6. Same query WITHOUT user filter
  let { data: adminLeads, count: adminCount } = await supabase.from('leads').select('id, name, email, company, user_id', { count: 'exact' }).neq('validation_status', 'invalid').neq('status', 'bounced').order('created_at', { ascending: false }).limit(5);
  console.log("\n=== ADMIN LEAD QUERY (no user filter) ===");
  console.log('Count:', adminCount);
  if (adminLeads) console.log('Sample:', JSON.stringify(adminLeads, null, 2));
  
  // 7. Check all user_ids in leads
  let { data: userIds } = await supabase.from('leads').select('user_id').neq('validation_status', 'invalid').limit(100);
  let uniqueIds = new Set((userIds || []).map(l => l.user_id));
  console.log('\nUnique user_ids in leads (non-invalid):', [...uniqueIds]);
  console.log('Logged in user:', user.user.id);
  
  // 8. Check if user_id filter is the problem
  let { data: userScopedLeads, count: userScopedCount } = await authedSupabase.from('leads').select('id', { count: 'exact' }).neq('validation_status', 'invalid').neq('status', 'bounced');
  console.log('\nUser-scoped lead count:', userScopedCount, '| user.id:', user.user.id);
}

main().catch(console.error);