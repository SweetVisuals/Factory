import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Setting up test data...");

  // Auth
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  
  if (!authData?.session) {
      console.log("Failed to authenticate.");
      return;
  }
  
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  // 1. Get a business ID
  const { data: businesses } = await client.from('businesses').select('id').limit(1);
  if (!businesses || businesses.length === 0) {
      console.log("No businesses found, cannot test.");
      return;
  }
  const businessId = businesses[0].id;

  // 2. Insert test campaign
  const { data: campaign, error: cErr } = await client.from('campaigns').insert([{
    name: "Test Greeting Fallback Campaign",
    status: "in_progress",
    business_id: businessId,
    contact_number: "555-0199",
    company_name: "Openclaw Test"
  }]).select().single();

  if (cErr) { console.error("Error creating campaign:", cErr); return; }
  console.log("Created campaign:", campaign.id);

  // 3. Insert test template
  const { data: template, error: tErr } = await client.from('templates').insert([{
    name: "Test Template",
    subject: "Checking the system, {first_name}",
    content: "Hi {first_name},\n\nJust sending a quick test to ensure the fallback logic works when there is no name provided.\n\nThanks!",
    business_id: businessId
  }]).select().single();

  if (tErr) { console.error("Error creating template:", tErr); return; }
  console.log("Created template:", template.id);

  // 4. Insert test lead with no name, but with a company name
  const { data: lead, error: lErr } = await client.from('leads').insert([{
    email: "acedkmgmt@gmail.com",
    name: "", // INTENTIONALLY BLANK to test fallback
    company: "Acme Innovations", // SHOULD USE THIS INSTEAD OF "THERE"
    status: "new"
  }]).select().single();

  if (lErr) { console.error("Error creating lead:", lErr); return; }
  console.log("Created lead:", lead.id);

  // 5. Link lead to campaign
  await client.from('campaign_leads').insert([{
    campaign_id: campaign.id,
    lead_id: lead.id
  }]);

  // 6. Get an active email account
  const { data: accounts } = await client.from('email_accounts').select('id').eq('status', 'active').limit(1);
  if (!accounts || accounts.length === 0) {
      console.log("No active email accounts found to send from.");
      return;
  }

  // 7. Schedule the email
  const { data: schedule, error: sErr } = await client.from('scheduled_emails').insert([{
    campaign_id: campaign.id,
    template_id: template.id,
    email_account_id: accounts[0].id,
    status: "scheduled",
    scheduled_date: new Date().toISOString()
  }]).select().single();

  if (sErr) { console.error("Error scheduling email:", sErr); return; }
  console.log("Scheduled email:", schedule.id);

  // 8. Trigger Edge Function
  console.log("Triggering process-campaign edge function...");
  const { data: triggerData, error: triggerErr } = await supabase.functions.invoke('process-campaign');
  
  if (triggerErr) {
      console.error("Edge function failed:", triggerErr);
  } else {
      console.log("Edge function finished successfully. Output:");
      console.log(triggerData);
  }

  console.log("Test finished! Check your inbox.");
}

runTest();
