/**
 * Email Output Preview & Test Tool
 * 
 * Preview generated emails without sending. Tests the full template engine pipeline.
 * 
 * Usage:
 *   node test_email_output.mjs                        # Preview random leads from active campaigns
 *   node test_email_output.mjs <campaign_id>           # Preview from specific campaign
 *   node test_email_output.mjs <campaign_id> <count>   # Preview N leads
 *   node test_email_output.mjs --all-steps <campaign_id>  # Show all sequence steps for leads
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateEmail, generateAllSteps } from './server/email_engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Formatting ──────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';
const BG_DARK = '\x1b[40m';

function divider(char = '─', len = 70) {
  return DIM + char.repeat(len) + RESET;
}

function wordCount(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const showAllSteps = args.includes('--all-steps');
  const filteredArgs = args.filter(a => !a.startsWith('--'));
  const campaignId = filteredArgs[0];
  const count = parseInt(filteredArgs[1]) || 5;

  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║          EMAIL OUTPUT PREVIEW TOOL                          ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${RESET}\n`);

  // 1. Get campaign(s)
  let campaignQuery = supabase
    .from('campaigns')
    .select(`
      id, name, niche, status, objective, email_tone_id, business_id,
      businesses ( id, name, overview_md, signature_template, status )
    `);

  if (campaignId) {
    campaignQuery = campaignQuery.eq('id', campaignId);
  } else {
    campaignQuery = campaignQuery.in('status', ['in_progress', 'active', 'email_only']);
  }

  const { data: campaigns, error: campErr } = await campaignQuery;
  if (campErr || !campaigns?.length) {
    console.error('❌ No campaigns found:', campErr?.message || 'None active');
    process.exit(1);
  }

  // Load email tones
  const { data: tones } = await supabase.from('email_tones').select('*');
  const toneMap = new Map((tones || []).map(t => [t.id, t]));

  // Load email accounts for sender context
  const { data: accounts } = await supabase.from('email_accounts').select('*');
  const senderAccount = accounts?.[0] || null;

  // Load templates for step count
  for (const campaign of campaigns) {
    console.log(`${BOLD}${GREEN}═══ Campaign: ${campaign.name} ═══${RESET}`);
    console.log(`${DIM}ID:       ${campaign.id}${RESET}`);
    console.log(`${DIM}Niche:    ${campaign.niche || 'N/A'}${RESET}`);
    console.log(`${DIM}Status:   ${campaign.status}${RESET}`);
    console.log(`${DIM}Business: ${campaign.businesses?.name || '❌ None'}${RESET}`);
    console.log(`${DIM}Tone:     ${campaign.email_tone_id ? toneMap.get(campaign.email_tone_id)?.name || 'Unknown' : '❌ None'}${RESET}`);
    console.log('');

    // Get templates for this campaign to know step count
    const { data: templates } = await supabase
      .from('templates')
      .select('id, name')
      .eq('campaign_id', campaign.id)
      .order('name');

    const totalSteps = templates?.length || 3;

    // Get random leads from this campaign
    const { data: campaignLeads, error: leadErr } = await supabase
      .from('campaign_leads')
      .select('lead_id, leads!inner(*)')
      .eq('campaign_id', campaign.id)
      .limit(count * 3); // Fetch extra to find good ones

    if (leadErr || !campaignLeads?.length) {
      console.log(`${YELLOW}⚠️  No leads found for this campaign.${RESET}\n`);
      continue;
    }

    // Shuffle and pick
    const shuffled = campaignLeads.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const emailTone = campaign.email_tone_id ? toneMap.get(campaign.email_tone_id) : tones?.[0];
    const business = campaign.businesses || null;

    for (let li = 0; li < selected.length; li++) {
      const lead = selected[li].leads;

      console.log(divider('═'));
      console.log(`${BOLD}${MAGENTA}Lead ${li + 1}/${selected.length}:${RESET} ${lead.name || 'No Name'} — ${lead.company || 'No Company'}`);
      console.log(`${DIM}Email:    ${lead.email}${RESET}`);
      console.log(`${DIM}Location: ${lead.location || 'N/A'}${RESET}`);
      console.log(`${DIM}Website:  ${lead.website || 'N/A'}${RESET}`);
      console.log(`${DIM}Industry: ${lead.industry || 'N/A'}${RESET}`);
      console.log(`${DIM}Summary:  ${lead.summary ? lead.summary.substring(0, 100) + '...' : 'None'}${RESET}`);
      console.log('');

      if (showAllSteps) {
        const allSteps = generateAllSteps({
          lead, campaign, business, emailTone,
          totalSteps, senderAccount
        });

        for (const step of allSteps) {
          const wc = wordCount(step.body);
          const wcColor = wc > 50 ? YELLOW : GREEN;
          console.log(`${BOLD}${CYAN}  ┌─ Step ${step.step} ────────────────────────────────────────────${RESET}`);
          console.log(`${BOLD}  │ Subject: ${WHITE}${step.subject}${RESET}`);
          console.log(`${DIM}  │ Words: ${wcColor}${wc}${RESET}`);
          console.log(`  │`);
          step.body.split('\n').forEach(line => {
            console.log(`  │ ${line}`);
          });
          console.log(`${BOLD}${CYAN}  └──────────────────────────────────────────────────────${RESET}`);
          console.log('');
        }
      } else {
        // Show just step 1
        const email = generateEmail({
          lead, campaign, business, emailTone,
          stepIndex: 0, totalSteps, senderAccount
        });

        const wc = wordCount(email.body);
        const wcColor = wc > 45 ? YELLOW : GREEN;
        console.log(`${BOLD}${CYAN}  ┌─ Step 1 (Hook) ─────────────────────────────────────────${RESET}`);
        console.log(`${BOLD}  │ Subject: ${WHITE}${email.subject}${RESET}`);
        console.log(`${DIM}  │ Words: ${wcColor}${wc}${RESET}`);
        console.log(`  │`);
        email.body.split('\n').forEach(line => {
          console.log(`  │ ${line}`);
        });
        console.log(`${BOLD}${CYAN}  └──────────────────────────────────────────────────────${RESET}`);
        console.log('');
      }
    }
  }

  // Summary stats
  console.log(divider('═'));
  console.log(`${BOLD}${GREEN}✅ Preview complete.${RESET}`);
  console.log(`${DIM}Campaigns: ${campaigns.length} | Leads previewed: ${count} per campaign${RESET}`);
  console.log(`${DIM}Use --all-steps to see all sequence steps for each lead.${RESET}`);
  console.log(`${DIM}Re-run to see different lead selections (randomised).${RESET}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
