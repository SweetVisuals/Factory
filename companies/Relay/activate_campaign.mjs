/**
 * Campaign Activation CLI
 * 
 * Sets up everything needed to start sending emails for a campaign:
 * 1. Lists campaigns and their current state
 * 2. Assigns a business profile if missing
 * 3. Creates scheduled_emails entries for each template step
 * 4. Links email accounts to schedules
 * 5. Validates everything before marking as ready
 * 
 * Usage: node activate_campaign.mjs [campaign_id]
 *   If no campaign_id provided, lists all campaigns for selection.
 *   
 * Examples:
 *   node activate_campaign.mjs                           # Interactive mode
 *   node activate_campaign.mjs list                      # Just list campaigns
 *   node activate_campaign.mjs <uuid>                    # Activate specific campaign
 *   node activate_campaign.mjs <uuid> --dry-run          # Preview what would happen
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[Activate] ${msg}`); }
function warn(msg) { console.log(`[⚠️  WARN] ${msg}`); }
function err(msg) { console.error(`[❌ ERROR] ${msg}`); }
function ok(msg) { console.log(`[✅   OK] ${msg}`); }

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// ─── List All Campaigns ──────────────────────────────────────────────────────
async function listCampaigns() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id, name, status, niche, business_id, objective, email_tone_id,
      businesses ( id, name, status )
    `)
    .order('name');

  if (error) { err(`Failed to fetch campaigns: ${error.message}`); return []; }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    ALL CAMPAIGNS                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const c of campaigns) {
    const bizName = c.businesses?.name || '❌ NONE';
    const statusIcon = {
      'in_progress': '🟢', 'active': '🟢', 'email_only': '🟢',
      'paused': '🟡', 'draft': '⚪', 'completed': '🔵'
    }[c.status] || '⚪';

    // Count leads
    const { count: leadCount } = await supabase
      .from('campaign_leads')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', c.id);

    // Count templates
    const { data: templates } = await supabase
      .from('templates')
      .select('id, name')
      .eq('campaign_id', c.id);

    // Count scheduled_emails
    const { data: schedules } = await supabase
      .from('scheduled_emails')
      .select('id, status')
      .eq('campaign_id', c.id);

    // Count emails already sent
    const { count: sentCount } = await supabase
      .from('campaign_progress')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', c.id)
      .eq('status', 'sent');

    const scheduleStatus = schedules?.length > 0
      ? `${schedules.length} schedules (${schedules.filter(s => s.status === 'scheduled').length} active)`
      : '❌ NO SCHEDULES';

    console.log(`${statusIcon} ${c.name}`);
    console.log(`   ID:        ${c.id}`);
    console.log(`   Status:    ${c.status}`);
    console.log(`   Niche:     ${c.niche || 'N/A'}`);
    console.log(`   Business:  ${bizName}`);
    console.log(`   Tone:      ${c.email_tone_id ? '✅ Set' : '❌ Not set'}`);
    console.log(`   Objective: ${c.objective || 'N/A'}`);
    console.log(`   Leads:     ${leadCount || 0}`);
    console.log(`   Templates: ${templates?.length || 0} (${templates?.map(t => t.name).join(', ') || 'none'})`);
    console.log(`   Schedules: ${scheduleStatus}`);
    console.log(`   Sent:      ${sentCount || 0}`);
    console.log('');
  }

  return campaigns;
}

// ─── Get Available Email Accounts ────────────────────────────────────────────
async function getEmailAccounts() {
  const { data, error } = await supabase
    .from('email_accounts')
    .select('id, email, name, smtp_host, smtp_port, daily_limit');
  if (error) { err(`Failed to fetch email accounts: ${error.message}`); return []; }
  return data || [];
}

// ─── Get Available Businesses ────────────────────────────────────────────────
async function getBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, status, overview_md, signature_template');
  if (error) { err(`Failed to fetch businesses: ${error.message}`); return []; }
  return data || [];
}

// ─── Get Email Tones ─────────────────────────────────────────────────────────
async function getEmailTones() {
  const { data, error } = await supabase
    .from('email_tones')
    .select('id, name, slug');
  if (error) { err(`Failed to fetch email tones: ${error.message}`); return []; }
  return data || [];
}

// ─── Activate a Campaign ─────────────────────────────────────────────────────
async function activateCampaign(campaignId, dryRun = false) {
  // 1. Load campaign
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('*, businesses ( id, name, status, overview_md )')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) {
    err(`Campaign not found: ${campErr?.message || 'No data'}`);
    return false;
  }

  log(`\nActivating: "${campaign.name}" (${campaign.status})`);
  log(`Niche: ${campaign.niche || 'N/A'}`);

  // 2. Check/assign business
  if (!campaign.business_id) {
    warn('No business profile linked to this campaign.');
    const businesses = await getBusinesses();
    if (businesses.length === 0) {
      err('No businesses exist. Create one first.');
      return false;
    }

    console.log('\nAvailable businesses:');
    businesses.forEach((b, i) => {
      console.log(`  [${i + 1}] ${b.name} (${b.status}) — ${b.overview_md ? '✅ Has overview' : '❌ No overview'}`);
    });

    const choice = await ask('\nSelect business number (or press Enter to skip): ');
    if (choice && parseInt(choice) > 0 && parseInt(choice) <= businesses.length) {
      const selectedBiz = businesses[parseInt(choice) - 1];
      if (!dryRun) {
        await supabase.from('campaigns').update({ business_id: selectedBiz.id }).eq('id', campaignId);
        ok(`Linked business "${selectedBiz.name}" to campaign.`);
      } else {
        log(`[DRY RUN] Would link business "${selectedBiz.name}"`);
      }
    }
  } else {
    ok(`Business: ${campaign.businesses?.name || campaign.business_id}`);
  }

  // 3. Check/assign email tone
  if (!campaign.email_tone_id) {
    warn('No email tone assigned to this campaign.');
    const tones = await getEmailTones();
    if (tones.length > 0) {
      console.log('\nAvailable email tones:');
      tones.forEach((t, i) => {
        console.log(`  [${i + 1}] ${t.name} (${t.slug})`);
      });
      const choice = await ask('\nSelect tone number (or Enter for default "Casual Conversational"): ');
      let selectedTone;
      if (choice && parseInt(choice) > 0 && parseInt(choice) <= tones.length) {
        selectedTone = tones[parseInt(choice) - 1];
      } else {
        selectedTone = tones.find(t => t.slug === 'casual-conversational') || tones[0];
      }
      if (!dryRun) {
        await supabase.from('campaigns').update({ email_tone_id: selectedTone.id }).eq('id', campaignId);
        ok(`Assigned tone: "${selectedTone.name}"`);
      } else {
        log(`[DRY RUN] Would assign tone: "${selectedTone.name}"`);
      }
    }
  } else {
    ok(`Email tone already assigned.`);
  }

  // 4. Get templates for this campaign
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('name');

  if (!templates || templates.length === 0) {
    err('No templates found for this campaign. Create templates first.');
    return false;
  }

  log(`Found ${templates.length} templates: ${templates.map(t => t.name).join(', ')}`);

  // 5. Get email accounts
  const accounts = await getEmailAccounts();
  if (accounts.length === 0) {
    err('No email accounts available. Add an email account first.');
    return false;
  }

  console.log('\nAvailable email accounts:');
  accounts.forEach((a, i) => {
    console.log(`  [${i + 1}] ${a.email} (${a.name}) — SMTP: ${a.smtp_host}:${a.smtp_port} — Limit: ${a.daily_limit}/day`);
  });

  const accountChoice = await ask('\nSelect email account(s) to use (comma-separated numbers, or Enter for all): ');
  let selectedAccounts;
  if (accountChoice?.trim()) {
    const indices = accountChoice.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < accounts.length);
    selectedAccounts = indices.map(i => accounts[i]);
  } else {
    selectedAccounts = accounts;
  }

  if (selectedAccounts.length === 0) {
    err('No email accounts selected.');
    return false;
  }
  ok(`Using ${selectedAccounts.length} email account(s): ${selectedAccounts.map(a => a.email).join(', ')}`);

  // 6. Configure schedule timing
  const { count: leadCount } = await supabase
    .from('campaign_leads')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  log(`\nCampaign has ${leadCount} leads.`);

  const intervalStr = await ask('Interval between emails in minutes (default 2): ');
  const intervalMinutes = parseInt(intervalStr) || 2;

  const emailsPerAccountStr = await ask(`Emails per account per run (default 40): `);
  const emailsPerAccount = parseInt(emailsPerAccountStr) || 40;

  const daysStr = await ask('Campaign duration in days (default 30): ');
  const durationDays = parseInt(daysStr) || 30;

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  console.log(`\n📋 Schedule Summary:`);
  console.log(`   Start:    ${startDate.toISOString()}`);
  console.log(`   End:      ${endDate.toISOString()}`);
  console.log(`   Interval: ${intervalMinutes} min between emails`);
  console.log(`   Per Acct: ${emailsPerAccount} emails/run`);
  console.log(`   Steps:    ${templates.length}`);
  console.log(`   Accounts: ${selectedAccounts.length}`);
  console.log(`   Max/day:  ~${Math.floor((60 / intervalMinutes) * 8 * selectedAccounts.length)} emails (8h sending window)`);

  // 7. Check for existing schedules
  const { data: existingSchedules } = await supabase
    .from('scheduled_emails')
    .select('id')
    .eq('campaign_id', campaignId);

  if (existingSchedules?.length > 0) {
    warn(`Campaign already has ${existingSchedules.length} schedule(s).`);
    const overwrite = await ask('Delete existing schedules and create new ones? (y/N): ');
    if (overwrite?.toLowerCase() !== 'y') {
      log('Keeping existing schedules. Exiting.');
      return false;
    }
    if (!dryRun) {
      // Delete schedule_email_accounts first (FK dependency)
      for (const sched of existingSchedules) {
        await supabase.from('schedule_email_accounts').delete().eq('schedule_id', sched.id);
      }
      await supabase.from('scheduled_emails').delete().eq('campaign_id', campaignId);
      ok('Deleted existing schedules.');
    }
  }

  // 8. Create scheduled_emails for each template step
  const confirm = await ask('\nCreate schedules and activate? (y/N): ');
  if (confirm?.toLowerCase() !== 'y') {
    log('Cancelled.');
    return false;
  }

  if (dryRun) {
    log('[DRY RUN] Would create the following schedules:');
    templates.forEach((tmpl, i) => {
      const stepStart = new Date(startDate.getTime() + i * intervalMinutes * 60 * 1000);
      console.log(`  Step ${i + 1}: "${tmpl.name}" — starts ${stepStart.toISOString()}`);
    });
    return true;
  }

  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    // Each step starts after the interval from the previous
    const stepScheduledFor = new Date(startDate.getTime() + i * intervalMinutes * 60 * 1000);

    const { data: schedule, error: schedErr } = await supabase
      .from('scheduled_emails')
      .insert({
        campaign_id: campaignId,
        template_id: tmpl.id,
        scheduled_for: stepScheduledFor.toISOString(),
        status: 'scheduled',
        total_emails: leadCount || 0,
        sent_emails: 0,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        interval_minutes: intervalMinutes,
        emails_per_account: emailsPerAccount
      })
      .select()
      .single();

    if (schedErr) {
      err(`Failed to create schedule for "${tmpl.name}": ${schedErr.message}`);
      continue;
    }

    ok(`Created schedule for "${tmpl.name}" (${schedule.id})`);

    // Link email accounts to this schedule
    for (const acct of selectedAccounts) {
      const { error: linkErr } = await supabase
        .from('schedule_email_accounts')
        .insert({
          schedule_id: schedule.id,
          email_account_id: acct.id,
          emails_sent: 0,
          emails_remaining: emailsPerAccount
        });

      if (linkErr) {
        err(`Failed to link account ${acct.email} to schedule: ${linkErr.message}`);
      } else {
        ok(`  Linked ${acct.email} to schedule`);
      }
    }
  }

  // 9. Update campaign status to active if it's not already
  if (!['active', 'in_progress', 'email_only'].includes(campaign.status)) {
    await supabase.from('campaigns').update({ status: 'in_progress' }).eq('id', campaignId);
    ok(`Campaign status updated to "in_progress".`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ✅ CAMPAIGN ACTIVATED SUCCESSFULLY                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nThe emailer cron will pick this up on its next cycle (runs every 1 minute).`);
  console.log(`To preview emails before sending, run: node test_email_output.mjs ${campaignId}\n`);

  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const campaignId = args.find(a => !a.startsWith('--') && a !== 'list');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            CAMPAIGN ACTIVATION CLI                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (args[0] === 'list' || !campaignId) {
    const campaigns = await listCampaigns();

    if (args[0] === 'list') {
      rl.close();
      process.exit(0);
    }

    // Interactive selection
    const input = await ask('Enter campaign ID to activate (or "q" to quit): ');
    if (!input || input.toLowerCase() === 'q') {
      rl.close();
      process.exit(0);
    }

    await activateCampaign(input.trim(), dryRun);
  } else {
    await activateCampaign(campaignId, dryRun);
  }

  rl.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
