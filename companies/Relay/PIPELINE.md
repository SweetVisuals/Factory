# Relay Cold Outreach Pipeline — Full System Map

## Services Used

| Service | Role | Where |
|---------|------|-------|
| **OpenClaw Factory** | AI agent orchestrator (Boss → Market Researcher → Scraper → Validator → Sales Strategist → Emailer) | `backend/agent_engine.js` |
| **Supabase** | Database, Auth, Edge Functions, pg_cron triggers | `fzcrjogrnujrfxafxbkh.supabase.co` |
| **Hetzner** | VPS hosting the Node.js server | Runs `companies/Relay/server/index.mjs` |
| **Puppeteer** | Deep research — scrapes prospect websites for pain points | `server/scraper.mjs` → `performDeepResearch()` |
| **Companies House API** | UK company data — finds directors, filing info, SIC codes | `server/companies_house_cron.mjs` |
| **DeepSeek** | AI personalization — rewrites templates per-lead using research | `process_campaign_node.mjs` |
| **Hermes** | Autonomous multi-step research agent (Llama 3 + tools) | `server/hermes_orchestrator.mjs` |
| **PrivateEmail (Namecheap)** | SMTP sending — `privateemail.com` accounts (`@relaysolutions.net`) | `email_accounts` table, sent via `nodemailer` |

---

## The Pipeline (End-to-End)

### 1. LEAD DISCOVERY

**Sources:**
- Google Maps scraping (Puppeteer) — niche + specific UK city
- Companies House API — UK company data, directors, SIC codes
- Hermes AI — autonomous web research for leads
- Manual import

**Output:** `leads` table (name, email, company, website) → `campaign_leads` junction

### 2. DEEP RESEARCH (Auto-Research Cron)

`emailer_cron.mjs` → `runAutoResearch()`
- Finds leads with websites but no summary
- Puppeteer scrapes their website
- Extracts pain points, services, team size
- Saves to `leads.summary` — this is how we find what they're struggling with (manual data logging, outdated systems, etc.)

### 3. SEQUENCE GENERATION (One-time per campaign)

Agent: Sales Strategist calls `RELAY_API: GENERATE_SEQUENCE`
- Reads `Relay_ColdEmail_AI_Brief.md` for tone/rules
- AI generates 5 email TEMPLATES (curiosity-based, not pitchy)
- Saved to `templates` table (step 1-5)
- Templates are GENERIC — personalization happens at send time

**TONE: Curious, pain-point-driven, NOT a pitch.**
- ✅ "Still manually logging compliance data into spreadsheets?"
- ✅ "Quick question — is your team still copying data between systems by hand?"
- ❌ "We build custom automation systems that save you 200 hours/year"
- ❌ "I'd love to show you our platform"

### 4. SCHEDULE ACTIVATION

Agent: Emailer calls `RELAY_API: ACTIVATE_SCHEDULE`
- Creates `scheduled_emails` entries (1 per template step)
- Links email accounts from `campaign_email_accounts`
- Sets 3-day intervals between steps
- Campaign status → `in_progress`

Email accounts: PrivateEmail (Namecheap) `@relaysolutions.net`
SMTP: `mail.privateemail.com:465` (SSL)

### 5. EMAIL SENDING (Every 1 minute — ALL campaigns in parallel)

**Trigger:** `emailer_cron.mjs` → `runProcessCampaign()`
**Also:** pg_cron → Edge Function `process-campaign` (backup)

For EACH campaign (all 5 in parallel via Promise.allSettled):
1. Fetch pending leads for this schedule step
2. Cross-campaign dedup (don't email same person twice)
3. Check inbox for replies (halt sequence if replied)
4. **AI PERSONALIZATION (DeepSeek):**
   - Takes template + `lead.summary` (pain points from research)
   - Rewrites into curiosity-based plain text email
   - Returns JSON `{ subject, body }`
5. Strip any AI-generated sign-offs from body
6. Append correct sign-off: sender name + company
7. Append `signature_template` from business settings
8. Replace any remaining placeholders
9. Send via SMTP (nodemailer → privateemail.com)
10. Log to `campaign_progress` + `inbox_emails`

**Step dependency:** Step 2 only sends AFTER Step 1 completes for each lead.
**Per-lead:** 48-hour minimum gap between steps.

### 6. FOLLOW-UP (Automatic)

Steps 2-5 auto-fire based on schedule dates (3-day gaps).
Each step checks if the lead replied → halts if so.
Lead status progression: `new` → `Day 2` → `Day 3` → ... → `Completed`
Bounced emails get marked and excluded permanently.

### 7. REPLY HANDLING & BOOKINGS

- IMAP sync pulls replies into `inbox_emails` table
- Process-campaign detects replies and marks lead `interested`
- Lead removed from further sequence steps automatically
- Replies visible in Relay dashboard inbox
- Manual booking / call scheduling from there

---

## Key Files

| File | Purpose |
|------|---------|
| `server/index.mjs` | Main Express server, starts all crons |
| `server/emailer_cron.mjs` | 1-min cron: triggers auto-research + email sending |
| `server/process_campaign_node.mjs` | Core email sender — personalization, signing, SMTP |
| `server/scraper.mjs` | Puppeteer lead scraping + `performDeepResearch()` |
| `server/companies_house_cron.mjs` | Companies House API lead enrichment |
| `server/auto_assign_cron.mjs` | Auto-assigns new leads to campaigns |
| `server/hermes_orchestrator.mjs` | Hermes AI autonomous research |
| `supabase/functions/process-campaign/index.ts` | Edge function backup (same logic) |
| `companies/Relay_ColdEmail_AI_Brief.md` | Email tone, rules, segments |

---

## Bugs Fixed

### Bug 1: Only 1 Campaign Sends At A Time
Sequential `for` loop → `Promise.allSettled()` by campaign_id

### Bug 2: Broken Name/Email in Footer
Post-assembly name stripping removed. URL regex fixed to not eat email body.
