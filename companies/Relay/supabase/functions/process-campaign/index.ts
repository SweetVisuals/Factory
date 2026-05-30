import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.13';

function isAccountAllowedForBusiness(email: string, businessSlug: string): boolean {
  const emailLower = email.toLowerCase();
  const slugLower = (businessSlug || '').toLowerCase();
  
  if (slugLower === 'mrmedic') {
    return emailLower.endsWith('@mrmedicevents.co.uk') || emailLower.endsWith('@mrmedicevents.org') || emailLower.endsWith('@mrmedicevens.org');
  }
  if (slugLower === 'relay') {
    return emailLower.endsWith('@relaysolutions.net');
  }
  
  // Fallback domain match logic
  const domain = emailLower.split('@')[1] || '';
  return domain.includes(slugLower) || slugLower.includes(domain.split('.')[0]);
}

// Config
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || 'sk-6733c8ac2b83402b8626e5e253824488';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const OPENROUTER_KEYS = [
  Deno.env.get('OPENROUTER_API_KEY'),
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY"
].filter(Boolean) as string[];

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch DeepSeek disable setting
    const { data: deepseekOption } = await supabaseAdmin
        .from('api_keys')
        .select('key_value')
        .eq('service', 'disable_deepseek')
        .maybeSingle();
    const disableDeepseek = deepseekOption?.key_value === 'true';

    console.log("Checking engine status...");
    const { data: engineStatus } = await supabaseAdmin
        .from('agent_memory')
        .select('value')
        .eq('key_name', 'factory_status')
        .maybeSingle();

    if (engineStatus?.value?.status === 'paused') {
        console.log("Engine is PAUSED. Standing by.");
        return new Response(JSON.stringify({ message: 'Engine paused' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // UK Time Gatekeeper
    const ukTimeOptions = { timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
    const ukTimeStr = new Intl.DateTimeFormat('en-GB', ukTimeOptions).format(new Date());
    const [ukHourStr, ukMinStr] = ukTimeStr.split(':');
    const ukHour = parseInt(ukHourStr, 10);
    const ukMin = parseInt(ukMinStr, 10);
    const ukMinutes = ukHour * 60 + ukMin;
    const startMinutes = 0; // 00:00 (Expanded to 24 hours)
    const endMinutes = 24 * 60 - 1; // 23:59

    if (ukMinutes < startMinutes || ukMinutes > endMinutes) {
        console.log(`Current UK Time is ${ukTimeStr}. Outside sending window (00:00 - 23:59). Standing by.`);
        return new Response(JSON.stringify({ message: `Outside sending window (UK Time: ${ukTimeStr})` }), { headers: { 'Content-Type': 'application/json' } });
    }

    console.log("Checking for scheduled campaigns...");

    const { data: activeSchedules, error } = await supabaseAdmin
        .from('scheduled_emails')
        .select(`
            *,
            campaigns!scheduled_emails_campaign_id_fkey!inner (
                id, name, status, company_name, contact_number, primary_email, business_id, current_step,
                businesses!inner (
                    id, name, status, slug, signature_template
                )
            ),
            templates!scheduled_emails_template_id_fkey!inner (*)
        `)
        .eq('status', 'scheduled')
        .eq('campaigns.status', 'in_progress')
        .eq('campaigns.businesses.status', 'active');

    if (error) {
        console.error("Database query error:", error);
        throw error;
    }

    if (!activeSchedules || activeSchedules.length === 0) {
        return new Response(JSON.stringify({ message: 'No active schedules' }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Filter activeSchedules to check business status and prevent MrMedic emails
    const filteredSchedules = (activeSchedules || []).filter((schedule: any) => {
        const campaign = schedule.campaigns;
        const business = campaign?.businesses;
        if (!business || business.status !== 'active') {
            console.log(`Skipping schedule ${schedule.id} because business status is not active (status: ${business?.status})`);
            return false;
        }

        return true;
    });

    if (filteredSchedules.length === 0) {
        return new Response(JSON.stringify({ message: 'No active schedules (all filtered or inactive)' }), { headers: { 'Content-Type': 'application/json' } });
    }

    const results = [];

    // Group schedules by campaign and sort by start_date
    const campaignGroups = new Map<string, typeof filteredSchedules>();
    for (const schedule of filteredSchedules) {
        const cid = schedule.campaign_id;
        if (!campaignGroups.has(cid)) campaignGroups.set(cid, []);
        campaignGroups.get(cid)!.push(schedule);
    }
    for (const [_, schedules] of campaignGroups) {
        schedules.sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    }

    for (const schedule of filteredSchedules) {
        const now = new Date();
        const endDate = new Date(schedule.end_date);
        const scheduledFor = new Date(schedule.scheduled_for);
        
        if (now > endDate) continue;
        if (now < scheduledFor) {
            console.log(`Skipping schedule ${schedule.id}: Not due until ${scheduledFor.toISOString()}`);
            continue;
        }

        // --- STEP-DEPENDENCY CHECK ---
        const campaignSchedules = campaignGroups.get(schedule.campaign_id) || [];
        const stepIndex = campaignSchedules.findIndex((s: any) => s.id === schedule.id);

        if (stepIndex > 0) {
            const prevSchedule = campaignSchedules[stepIndex - 1];

            // If the PREVIOUS schedule still has pending leads, this step shouldn't proceed
            const { data: pendingForPrev, error: prevErr } = await supabaseAdmin
                .rpc('get_pending_campaign_leads', {
                    campaign_id_param: schedule.campaign_id,
                    schedule_id_param: prevSchedule.id
                })
                .limit(1);

            if (prevErr) {
                console.error("Error checking dependency", prevErr);
                continue; // Skip safely
            }

            if (pendingForPrev && pendingForPrev.length > 0) {
                console.log(`Skipping step ${stepIndex + 1} (schedule ${schedule.id}): Previous step is not yet complete.`);

                // Strict 24-hour gap between steps
                const gapMs = 24 * 60 * 60 * 1000;
                let minStartMs = new Date(prevSchedule.start_date).getTime() + gapMs;
                
                if (minStartMs < now.getTime() + gapMs) {
                    minStartMs = now.getTime() + gapMs;
                }

                if (new Date(schedule.start_date).getTime() < minStartMs) {
                    const newStart = new Date(minStartMs);
                    const durationMs = new Date(schedule.end_date).getTime() - new Date(schedule.start_date).getTime();
                    const newEnd = new Date(minStartMs + durationMs);

                    await supabaseAdmin.from('scheduled_emails').update({
                        start_date: newStart.toISOString(),
                        scheduled_for: newStart.toISOString(),
                        end_date: newEnd.toISOString()
                    }).eq('id', schedule.id);

                    schedule.start_date = newStart.toISOString();
                    schedule.scheduled_for = newStart.toISOString();
                    schedule.end_date = newEnd.toISOString();

                    console.log(`Self-healed step ${stepIndex + 1}: pushed start date to ${newStart.toISOString()} to maintain gap.`);
                }
                continue;
            }
            console.log(`Step ${stepIndex + 1} (schedule ${schedule.id}): Previous step complete. Proceeding.`);
            
            if (schedule.campaigns.current_step !== stepIndex + 1) {
                await supabaseAdmin.from('campaigns').update({ current_step: stepIndex + 1 }).eq('id', schedule.campaign_id);
                schedule.campaigns.current_step = stepIndex + 1;
            }
        } else {
            // First step
            if (schedule.campaigns.current_step !== 1) {
                await supabaseAdmin.from('campaigns').update({ current_step: 1 }).eq('id', schedule.campaign_id);
                schedule.campaigns.current_step = 1;
            }
        }

        // Interval check bypassed: Email as soon as a lead is added to the campaign
        const minInterval = schedule.interval_minutes || 0;
        // Check removed to ensure immediate sending when new leads arrive
        // (The pg_cron job will trigger this function every minute)

        // Get Accounts enabled for this schedule
        const { data: rawScheduleAccounts } = await supabaseAdmin
           .from('schedule_email_accounts')
           .select(`*, email_accounts!inner(*)`)
           .eq('schedule_id', schedule.id);

        if (!rawScheduleAccounts || rawScheduleAccounts.length === 0) continue;

        const businessSlug = schedule.campaigns?.businesses?.slug || '';
        const scheduleAccounts = (rawScheduleAccounts || []).filter((sa: any) => {
            const acc = sa.email_accounts;
            if (!acc) return false;
            return isAccountAllowedForBusiness(acc.email, businessSlug);
        });

        if (scheduleAccounts.length === 0) {
             console.log(`Schedule ${schedule.id}: No active email accounts allowed for business ${businessSlug}.`);
             continue;
        }

        // Get Pending Leads (limited to prevent timeouts)
        const maxBatchSize = Math.min(30, scheduleAccounts.length * 5);
        const { data: pendingLeads, error: pendingError } = await supabaseAdmin
            .rpc('get_pending_campaign_leads', { 
                campaign_id_param: schedule.campaign_id,
                schedule_id_param: schedule.id 
            })
            .limit(maxBatchSize);

        if (pendingError) { console.error("Error fetching pending leads", pendingError); continue; }
        if (!pendingLeads || pendingLeads.length === 0) {
             console.log(`Schedule ${schedule.id}: No pending leads.`);
             continue;
        }

        // ═══ CROSS-CAMPAIGN DEDUPLICATION ═══
        // Check if any of these leads are already being emailed by ANOTHER campaign
        // to prevent the same person getting hit from multiple campaigns simultaneously
        const leadEmails = pendingLeads.map((l: any) => l.email).filter(Boolean);
        let crossCampaignSentEmails: Set<string> = new Set();
        let inboxSentEmails: Set<string> = new Set();
        
        if (leadEmails.length > 0) {
            const { data: alreadySent } = await supabaseAdmin
                .from('campaign_progress')
                .select('leads!inner(email)')
                .neq('campaign_id', schedule.campaign_id)
                .eq('status', 'sent')
                .in('leads.email', leadEmails);
            if (alreadySent) {
                for (const row of alreadySent) {
                    if ((row as any).leads?.email) crossCampaignSentEmails.add((row as any).leads.email.toLowerCase());
                }
            }
            if (crossCampaignSentEmails.size > 0) {
                console.log(`[DEDUP] Filtering ${crossCampaignSentEmails.size} leads already targeted by other campaigns.`);
            }

            // Also check inbox_emails if this is step 1, to prevent emailing someone we already have a conversation with
            if (stepIndex === 0) {
                const { data: inboxHistory } = await supabaseAdmin
                    .from('inbox_emails')
                    .select('to')
                    .in('to', leadEmails);
                if (inboxHistory) {
                    for (const row of inboxHistory) {
                        if (row.to) inboxSentEmails.add(row.to.toLowerCase());
                    }
                }
                if (inboxSentEmails.size > 0) {
                    console.log(`[DEDUP] Filtering ${inboxSentEmails.size} leads already present in inbox history.`);
                }
            }
        }

        console.log(`Schedule ${schedule.id}: Processing ${pendingLeads.length} leads across ${scheduleAccounts.length} accounts.`);

        let sentCount = 0;
        let accountIndex = 0;

        for (const lead of pendingLeads) {
             if (Date.now() - startTime > 100000) {
                 console.log(`Time limit exceeded (${Math.round((Date.now() - startTime)/1000)}s elapsed). Exiting loop early to save progress.`);
                 break;
             }
             // Pre-send validation
             if (!lead.email || lead.email.trim() === '' || !lead.email.includes('@')) {
                 console.warn(`Skipping lead ${lead.id}: Invalid email "${lead.email}"`);
                 await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: scheduleAccounts[0].email_accounts.id,
                    status: 'failed', updated_at: new Date().toISOString()
                 }, { onConflict: 'campaign_id,schedule_id,lead_id' });
                 continue;
             }

             // ═══ CROSS-CAMPAIGN DUPLICATE CHECK ═══
             if (crossCampaignSentEmails.has(lead.email.toLowerCase()) || inboxSentEmails.has(lead.email.toLowerCase())) {
                 console.log(`[DEDUP] Skipping lead ${lead.email}: Already targeted by another campaign or in inbox history.`);
                 await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: scheduleAccounts[0].email_accounts.id,
                    status: 'failed' /* skipped_duplicate */, updated_at: new Date().toISOString()
                 }, { onConflict: 'campaign_id,schedule_id,lead_id' });
                 continue;
             }

             // Skip if lead has already replied or is interested or unsubscribed
             if (['interested', 'replied', 'unsubscribed', 'bounced'].includes(lead.status)) {
                 console.log(`Skipping lead ${lead.email}: Status is ${lead.status}`);
                 await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: scheduleAccounts[0].email_accounts.id,
                    status: lead.status === 'unsubscribed' ? 'unsubscribed' : 'replied', 
                    updated_at: new Date().toISOString()
                 }, { onConflict: 'campaign_id,schedule_id,lead_id' });
                 continue;
             }

             // --- SENDER CONSISTENCY ENFORCEMENT ---
             let account = null;
             if (lead.assigned_email_account_id) {
                 // First try to find it in the current schedule's accounts
                 const found = scheduleAccounts.find(a => a.email_accounts.id === lead.assigned_email_account_id);
                 if (found) {
                     account = found.email_accounts;
                 } else {
                     // If not in schedule, fetch it directly from DB to ensure consistency
                     const { data: directAcc } = await supabaseAdmin
                        .from('email_accounts')
                        .select('*')
                        .eq('id', lead.assigned_email_account_id)
                        .single();
                     if (directAcc && isAccountAllowedForBusiness(directAcc.email, businessSlug)) {
                         account = directAcc;
                         console.log(`Lead ${lead.email} using consistently assigned account ${account.email} even if not explicitly in schedule.`);
                     } else {
                         console.warn(`Consistently assigned account for lead ${lead.email} is NOT allowed for business ${businessSlug}. Reassigning...`);
                     }
                 }
             }
             
             if (!account) {
                 const accountEntry = scheduleAccounts[accountIndex % scheduleAccounts.length];
                 account = accountEntry.email_accounts;
                 accountIndex++;
                 try {
                     await supabaseAdmin.from('campaign_leads')
                        .update({ assigned_email_account_id: account.id })
                        .eq('campaign_id', schedule.campaign_id)
                        .eq('lead_id', lead.id);
                 } catch (e) { console.error("Failed to save assignment", e); }
             }

             // --- INBOX SCANNING FOR REPLIES ---
             let leadReply = null;
             let ourLastEmail = null;
             let originalSubject = null;

             try {
                const { data: ourSentEmails } = await supabaseAdmin
                    .from('inbox_emails')
                    .select('subject, body_text, received_at')
                    .eq('campaign_id', schedule.campaign_id)
                    .eq('to', lead.email)
                    .eq('folder', 'sent')
                    .order('received_at', { ascending: false })
                    .limit(1);

                if (ourSentEmails && ourSentEmails.length > 0) {
                    const lastSent = ourSentEmails[0];
                    ourLastEmail = lastSent.body_text;
                    originalSubject = lastSent.subject;

                    let cleanSubject = lastSent.subject.replace(/^(Re|Fwd|Fw|Aw|Reply):\s*/i, '').trim();
                    let safeSubject = cleanSubject.replace(/[%_]/g, '\\$&'); 
                    
                    const { data: possibleReplies } = await supabaseAdmin
                        .from('inbox_emails')
                        .select('body_text, received_at')
                        .eq('folder', 'inbox')
                        .gte('received_at', lastSent.received_at)
                        .or(`from.ilike.%${lead.email}%,subject.ilike.%${safeSubject}%`)
                        .order('received_at', { ascending: true });

                    if (possibleReplies && possibleReplies.length > 0) {
                        leadReply = possibleReplies.map(r => r.body_text).join('\n---\n');
                    }
                }
             } catch (scanErr) {
                 console.error("Error scanning inbox", scanErr);
             }

             if (leadReply) {
                 console.log(`[Campaign ${schedule.campaign_id}] Lead ${lead.email} replied. Halting sequence.`);
                 await supabaseAdmin.from('leads').update({ status: 'interested' }).eq('id', lead.id);
                 await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: account.id,
                    status: 'replied', updated_at: new Date().toISOString()
                 }, { onConflict: 'campaign_id,schedule_id,lead_id' });

                 const { data: otherSchedules } = await supabaseAdmin
                    .from('scheduled_emails')
                    .select('id')
                    .eq('campaign_id', schedule.campaign_id)
                    .neq('id', schedule.id);
                 
                 if (otherSchedules && otherSchedules.length > 0) {
                    for (const other of otherSchedules) {
                        await supabaseAdmin.from('campaign_progress').upsert({
                            campaign_id: schedule.campaign_id, schedule_id: other.id,
                            lead_id: lead.id, email_account_id: account.id,
                            status: 'replied', updated_at: new Date().toISOString()
                        }, { onConflict: 'campaign_id,schedule_id,lead_id' });
                    }
                 }
                 continue;
             }

             // --- PREPARE BASE LEAD INFO ---
              let firstName = (lead.name || '').trim();
              let companyName = (lead.company || '').trim();
              let safeFirstName = firstName.split(' ')[0];
              const lowerName = firstName.toLowerCase();
              const businessKeywords = ['ltd', 'limited', 'llc', 'inc', 'agency', 'digital', 'marketing', 'consulting', 'solutions', 'services', 'group', 'partners', 'associates', 'studio', 'entertainment', 'warehouse', 'management', 'technologies', 'designs', 'property', 'properties', 'real estate', 'clinic', 'dental', 'medical', 'events'];
              const isBusinessName = businessKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lowerName));

              const nameIsUnusable = !firstName || lowerName === 'the' || lowerName.startsWith('the ') ||
                  lowerName.startsWith('a ') || lowerName.startsWith('an ') ||
                  (companyName && lowerName === companyName.toLowerCase()) ||
                  isBusinessName || firstName.split(' ').length > 3;

             if (nameIsUnusable) {
                  if (companyName && companyName.length > 1 && companyName.length <= 30) {
                      safeFirstName = companyName;
                  } else {
                      safeFirstName = 'there';
                  }
              } else {
                  safeFirstName = safeFirstName.charAt(0).toUpperCase() + safeFirstName.slice(1).toLowerCase();
              }

             // --- JIT PERSONALIZATION & PLACEHOLDER HANDLING ---
             const isStep1 = stepIndex === 0;
             let bodyContent = isStep1 ? lead.personalized_email : null;
             let subjectContent = isStep1 ? lead.personalized_subject : null;
             
             const hasPlaceholders = (schedule.templates.content.includes('{') || schedule.templates.content.includes('[')) ||
                                     (schedule.templates.subject.includes('{') || schedule.templates.subject.includes('['));

             // Force AI personalization if we don't have bodyContent/subjectContent yet, AND (it's Step 1 OR the template has placeholders)
             const needsPersonalization = (!bodyContent || !subjectContent) && (isStep1 || hasPlaceholders);

             if (needsPersonalization && lead.summary) {
                 try {
                     const leadFirstName = safeFirstName;
                     let templateBodyForAI = schedule.templates.content
                         .replace(/\n*\{ender\}[\s\S]*$/i, '')
                         .replace(/\n*\{\{ender\}\}[\s\S]*$/i, '')
                         .replace(/\n*\[Sender Name\][\s\S]*$/i, '')
                         .replace(/\n*<company>[\s\S]*$/i, '')
                         .trim();

                     const systemPrompt = "You are a world-class B2B sales strategist personalizing cold outreach. Your goal is to rewrite the provided email template to be highly relevant to the specific lead based on their business summary.\n\n" +
"CRITICAL RULES:\n" +
"1. DO NOT return a template with placeholders like [Name] or {{company}}. Return the FINISHED email.\n" +
"2. Start the email with a proper greeting: 'Hi " + (leadFirstName.toLowerCase() === 'there' ? 'there' : leadFirstName) + ",'\n" +
"3. Write a unique, personalized opening sentence based on the provided Lead Notes.\n" +
"4. Maintain the core offer and call to action from the Original Template.\n" +
"5. Tone: Professional, helpful, concise, and slightly informal (like a colleague).\n" +
"6. ABSOLUTELY DO NOT include any sign-off, closing, or signature in the body. No Best, Regards, Cheers, Thanks, Sincerely, or ANY name at the end. The system auto-appends the correct sender signature. Including one will cause a DUPLICATE and a WRONG NAME.\n" +
"7. LENGTH LIMITS: The core email body MUST NOT exceed 60 words and 350 characters.\n" +
"8. FORMATTING: Use proper paragraph breaks (newlines \\n) to make it readable. Do not output a single block of text.\n" +
"9. Output ONLY valid JSON: { \"subject\": \"Customized subject line\", \"body\": \"Finished email body with newlines\" }";

            const userPrompt = "Original Template Subject: \"" + schedule.templates.subject + "\"\n" +
"Original Template Body: \"" + templateBodyForAI + "\"\n" +
"Lead Name: " + leadFirstName + "\n" +
"Lead Company: " + (lead.company || 'their business') + "\n" +
"Lead Notes: \"" + (lead.summary || '') + "\"\n\n" +
"Instructions: Customize the subject and body for this lead. Remove all placeholders. Ensure the transition from the personalized opening to the core message is seamless.\n" +
"Example of seamless integration:\n" +
"Lead Notes: 'Recently expanded their logistics fleet.'\n" +
"Resulting Body: 'Hi " + (leadFirstName.toLowerCase() === 'there' ? 'there' : leadFirstName) + ", noticed " + (lead.company || 'your business') + " recently expanded its logistics fleet. Many teams struggle with...'";

                      let aiResp: any;
                       if (disableDeepseek) {
                           console.log("DeepSeek is disabled. Trying OpenRouter key cycling...");
                           let success = false;
                           for (let k = 0; k < OPENROUTER_KEYS.length; k++) {
                               const apiKey = OPENROUTER_KEYS[k];
                               try {
                                   const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                                       method: 'POST',
                                       headers: {
                                           'Content-Type': 'application/json',
                                           'Authorization': `Bearer ${apiKey}`,
                                           'HTTP-Referer': 'https://github.com/Openclaw-Factory',
                                           'X-Title': 'ColdSpark'
                                       },
                                       body: JSON.stringify({
                                           model: 'openrouter/owl-alpha',
                                           messages: [
                                               { role: 'system', content: systemPrompt },
                                               { role: 'user', content: userPrompt }
                                           ],
                                           response_format: { type: 'json_object' }
                                       })
                                   });
                                   if (res.ok) {
                                       const data = await res.json();
                                       if (data && !data.error && data.choices?.[0]) {
                                           aiResp = {
                                               status: 200,
                                               ok: true,
                                               json: async () => data,
                                               text: async () => JSON.stringify(data)
                                           };
                                           success = true;
                                           break;
                                       } else {
                                           console.error(`OpenRouter Key ${k + 1} API Error:`, data?.error?.message || JSON.stringify(data?.error));
                                       }
                                   } else {
                                       console.error(`OpenRouter Key ${k + 1} Status Error:`, res.status, await res.text());
                                   }
                               } catch (err) {
                                   console.error(`OpenRouter Key ${k + 1} Network/Timeout Error:`, err);
                               }
                           }
                           if (!success) {
                               aiResp = {
                                   status: 402,
                                   ok: false,
                                   json: async () => ({ error: "All OpenRouter keys failed" }),
                                   text: async () => "All OpenRouter keys failed"
                               };
                           }
                       } else {
                           aiResp = await fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
                              },
                              body: JSON.stringify({
                                  model: 'deepseek-chat',
                                  messages: [
                                      { role: 'system', content: systemPrompt },
                                      { role: 'user', content: userPrompt }
                                  ],
                                  response_format: { type: 'json_object' }
                              })
                           });
                       }

                       if (aiResp.status === 402 || aiResp.status === 429 || !aiResp.ok) {
                           const errText = await aiResp.text();
                           console.error(`DeepSeek API Error (status ${aiResp.status}):`, errText);
                           
                           const isInsufficientCredits = aiResp.status === 402 || 
                               errText.toLowerCase().includes('balance') || 
                               errText.toLowerCase().includes('credit') || 
                               errText.toLowerCase().includes('insufficient');
                           
                           if (isInsufficientCredits) {
                               console.log("Credit exhaustion detected! Pausing factory engine.");
                               
                               // Pause the engine
                               await supabaseAdmin.from('agent_memory')
                                   .upsert({ 
                                       key_name: 'factory_status', 
                                       value: { status: 'paused', reason: 'insufficient_credits' } 
                                   }, { onConflict: 'key_name' });
                               
                               await supabaseAdmin.from('debug_logs').insert({
                                   level: 'error',
                                   message: 'DeepSeek personalizer paused sequence engine due to insufficient AI credits',
                                   context: { status: aiResp.status, error: errText, campaign_id: schedule.campaign_id }
                               });

                               return new Response(JSON.stringify({ 
                                   success: false, 
                                   error: 'Engine paused due to insufficient AI credits' 
                               }), {
                                   status: 402,
                                   headers: { 'Content-Type': 'application/json' }
                               });
                           } else {
                               throw new Error(`DeepSeek API non-ok response (${aiResp.status}): ${errText}`);
                           }
                       } else {
                           const aiData = await aiResp.json();
                           if (aiData.choices && aiData.choices[0]) {
                               const rawContent = aiData.choices[0].message.content.trim();
                               try {
                                   const jsonStr = rawContent.replace(/\`\`\`json\n|\n\`\`\`/g, '').trim();
                                   const parsed = JSON.parse(jsonStr);
                                   bodyContent = parsed.body || parsed.Body || rawContent;
                                   subjectContent = parsed.subject || parsed.Subject || '';
                               } catch {
                                   bodyContent = rawContent;
                               }
                               
                               // Ensure literal '\n' strings are converted to actual newlines
                               if (bodyContent) {
                                   bodyContent = bodyContent.replace(/\\n/g, '\n');
                               }
                               
                                // ═══ GREETING SAFEGUARD ═══
                                if (bodyContent) {
                                    const expectedGreeting = leadFirstName.toLowerCase() === 'there' ? 'there' : leadFirstName;
                                    const trimmedBody = bodyContent.trimStart();
                                    const startsWithHi = /^Hi\s/i.test(trimmedBody);
                                    const startsWithHey = /^Hey\s/i.test(trimmedBody);
                                    const startsWithHello = /^Hello\s/i.test(trimmedBody);
                                    const hasProperGreeting = startsWithHi || startsWithHey || startsWithHello;

                                    if (!hasProperGreeting) {
                                        const startsWithName = trimmedBody.toLowerCase().startsWith(expectedGreeting.toLowerCase());
                                        if (startsWithName) {
                                            bodyContent = 'Hi ' + trimmedBody;
                                            console.log(`[GREETING FIX] Prepended 'Hi ' to truncated greeting for ${lead.email}`);
                                        } else {
                                            bodyContent = `Hi ${expectedGreeting},\n\n${trimmedBody}`;
                                            console.log(`[GREETING FIX] Added full greeting 'Hi ${expectedGreeting},' for ${lead.email}`);
                                        }
                                    }
                                }

                               await supabaseAdmin.from('leads')
                                   .update({ personalized_email: bodyContent, personalized_subject: subjectContent })
                                   .eq('id', lead.id);
                           }
                       }
                  } catch (err) {
                      console.error("AI Personalization Failed", err);
                  }
             }

             // Fallback to template if AI failed or wasn't run
             if (!bodyContent) bodyContent = schedule.templates.content;
             if (!subjectContent) subjectContent = schedule.templates.subject;

             // Sender info
             let senderFirstName = 'Sender';
             if (account.name) senderFirstName = account.name.split(' ')[0];
             else if (account.email) {
                 senderFirstName = account.email.split('@')[0];
                 senderFirstName = senderFirstName.charAt(0).toUpperCase() + senderFirstName.slice(1);
             }

             const senderPhone = schedule.campaigns.contact_number || account.phone_number || '';
             const senderCompany = schedule.campaigns.company_name || account.company || '';
             const senderName = account.name || senderFirstName;
             const senderEmail = account.email;

             const enders = ['Best,', 'Kind regards,', 'Regards,', 'Warm regards,', 'Cheers,'];
             const randomEnder = enders[Math.floor(Math.random() * enders.length)];

             // ═══ FIX: ALWAYS STRIP EXISTING SIGN-OFFS, THEN APPEND CORRECT ONE ═══
             let strippedBody = bodyContent;

             // Strip sign-offs at the end
             const signOffStrip = /\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*(?:\n[\s\S]{0,200}|\s*$)/i;
             strippedBody = strippedBody.replace(signOffStrip, '').trimEnd();
             strippedBody = strippedBody.replace(/\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*$/i, '').trimEnd();

             // Also strip {ender} placeholders and everything after them
             strippedBody = strippedBody
                 .replace(/\n*\s*\{\{?ender\}\}?[\s\S]*$/i, '')
                 .replace(/\n*\s*\[Sender Name\][\s\S]*$/i, '')
                 .trimEnd();

             // Build the correct sign-off using the ACTUAL sending account
             const cleanSignature = account.signature ? account.signature.trim() : '';
             
             // --- SUBTLE OPT-OUT ---
             let randomOptOut = "";
             if (stepIndex === 0) {
                 randomOptOut = "Not the right time? Just let me know and I'll update my records.";
             } else if (stepIndex === 4) {
                 randomOptOut = "Still not the right time? Just let me know and I'll update my records.";
             }
             
             let personalContent: string;

             if (cleanSignature) {
                 personalContent = `${strippedBody}\n\n${cleanSignature}${randomOptOut ? '\n\n' + randomOptOut : ''}`;
             } else {
                 const senderFullName = account.name || senderFirstName;
                 personalContent = `${strippedBody}\n\n${randomEnder}\n${senderFullName}\n${senderCompany}${randomOptOut ? '\n\n' + randomOptOut : ''}`.trimEnd();
             }

             // --- COMPREHENSIVE PLACEHOLDER REPLACEMENT (Fallback for AI misses) ---
             const replacements = [
                { pattern: /{{first_name}}|{first_name}|{firstName}|\[First Name\]/gi, val: safeFirstName },
                { pattern: /{{name}}|{name}|\[Name\]/gi, val: lead.name || safeFirstName },
                { pattern: /{{company}}|{company}|{companyName}|\[Company\]/gi, val: companyName || 'your business' },
                { pattern: /{{industry}}|{industry}/gi, val: lead.industry || 'industry' },
                { pattern: /{{location}}|{location}/gi, val: lead.location || '' },
                { pattern: /{{sender_name}}|{sender_name}|\[Sender Name\]/gi, val: senderName },
                { pattern: /{{sender_email}}|{sender_email}|<primaryemail>|\[Email\]/gi, val: senderEmail },
                { pattern: /{{sender_phone}}|{sender_phone}|<contactnumber>|\[Phone\]/gi, val: senderPhone },
                { pattern: /{{sender_company}}|{sender_company}|<company>/gi, val: senderCompany },
                { pattern: /{{ender}}|{ender}/gi, val: randomEnder }
             ];

               // Append Signature Template if it exists
               const signatureTemplate = schedule.campaigns?.businesses?.signature_template || '';
               let fullContent = personalContent;
               if (signatureTemplate) {
                   fullContent += '\n\n' + signatureTemplate;
               }

               let finalBody = fullContent;
               let finalSubject = subjectContent;

               replacements.forEach(r => {
                  finalBody = finalBody.replace(r.pattern, r.val);
                  finalSubject = finalSubject.replace(r.pattern, r.val);
               });

               // ═══ FIX: BARE GREETING CLEANUP ═══
               // If the email starts with "there," or "Company Name," fix it to "Hi there," / "Hi Company Name,"
               finalBody = finalBody.replace(/^there\s*[,:-]*\s*/i, 'Hi there,\n\n');
               if (safeFirstName && safeFirstName.toLowerCase() !== 'there') {
                   const safeReg = safeFirstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                   const nameRegex = new RegExp(`^${safeReg}\\s*[,:-]*\\s*`, 'i');
                   finalBody = finalBody.replace(nameRegex, `Hi ${safeFirstName},\n\n`);
               }
               
               // Unsubscribe link removed per user request

             // Final cleanup for any leftover placeholders
             const placeholderRegex = /{{.*?}}|{.*?}|\[.*?\]/g;
             const unreplaced = (finalBody.match(placeholderRegex) || []).filter(m => !m.match(/^\[\s*\]$/) && !m.toLowerCase().includes('unsubscribe'));
             const subjectUnreplaced = (finalSubject.match(placeholderRegex) || []);
             
             if (unreplaced.length > 0 || subjectUnreplaced.length > 0) {
                 console.warn("Found unreplaced placeholders, marking as failed:", [...unreplaced, ...subjectUnreplaced]);
                 await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: account.id,
                    status: 'failed', updated_at: new Date().toISOString()
                 }, { onConflict: 'campaign_id,schedule_id,lead_id' });
                 continue;
             }

             // Decrypt Password
             const { data: decrypted } = await supabaseAdmin.rpc('decrypt_password', { 
                 encrypted_password: account.encrypted_password 
             });

             if (!decrypted) { 
                 console.error("Failed to decrypt password for account", account.email);
                 continue; 
             }

             // Check domain email limit
             const senderIdentifier = account.email.toLowerCase();
             if (senderIdentifier) {
                 const { data: canSend } = await supabaseAdmin.rpc('increment_domain_email_count', {
                     p_domain: senderIdentifier,
                     p_max_limit: 50 
                 });
                 if (!canSend) {
                     console.log(`Account limit reached for ${senderIdentifier}.`);
                     continue;
                 }
             }

             // SEND
             try {
                 const transporter = nodemailer.createTransport({
                     host: account.smtp_host,
                     port: account.smtp_port,
                     secure: String(account.smtp_port) === '465',
                     auth: { user: account.email, pass: decrypted }
                 });

                 const finalHtml = finalBody.replace(/\r?\n/g, '<br/>');

                 await transporter.sendMail({
                     from: account.name ? '"' + account.name + '" <' + account.email + '>' : account.email,
                     to: lead.email,
                     subject: finalSubject,
                     text: finalBody,
                     html: finalHtml
                 });

                await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: account.id,
                    status: 'sent', sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'campaign_id,schedule_id,lead_id' });

                const { data: currentStats } = await supabaseAdmin
                      .from('scheduled_emails').select('sent_emails').eq('id', schedule.id).single();
                if (currentStats) {
                    await supabaseAdmin.from('scheduled_emails')
                        .update({ sent_emails: (currentStats.sent_emails || 0) + 1 }).eq('id', schedule.id);
                }

                const { error: inboxError } = await supabaseAdmin.from('inbox_emails').insert({
                     email_account_id: account.id, folder: 'sent',
                     uid: Math.floor(Math.random() * 1000000000),
                     from: account.email, to: lead.email,
                     subject: finalSubject, body_text: finalBody,
                     body_html: finalBody.replace(/\n/g, '<br/>'),
                     snippet: finalBody.substring(0, 100),
                     received_at: new Date().toISOString(),
                     is_read: true, campaign_id: schedule.campaign_id,
                     sequence_step: schedule.templates.name
                });

                if (inboxError) {
                    console.error("❌ Inbox Insert Failed:", inboxError.message);
                    await supabaseAdmin.from('debug_logs').insert({
                        level: 'error',
                        message: `Failed to insert sent email to inbox: ${inboxError.message}`,
                        context: { schedule_id: schedule.id, lead_id: lead.id }
                    });
                } else {
                    console.log("✅ Sent email persisted to inbox.");
                }

                // Update lead status to reflect day progression or completion
                const nextStepNum = stepIndex + 2;
                const leadStatusToSet = nextStepNum > 5 ? 'Completed' : `Day ${nextStepNum}`;
                await supabaseAdmin.from('leads').update({ status: leadStatusToSet }).eq('id', lead.id);
                console.log(`✅ Updated lead ${lead.email} status to ${leadStatusToSet}`);
                
                sentCount++;
                results.push({ email: lead.email, status: 'sent', from: account.email });
             } catch (sendErr: any) {
                 console.error("❌ Send Failed:", sendErr?.message || sendErr);
                 await supabaseAdmin.from('debug_logs').insert({
                     level: 'error',
                     message: `SMTP Send Failed for lead ${lead.email}: ${sendErr?.message || sendErr}`,
                     context: { schedule_id: schedule.id, lead_id: lead.id, error: String(sendErr?.stack || sendErr) }
                 });
                 await supabaseAdmin.from('campaign_progress').upsert({
                    campaign_id: schedule.campaign_id, schedule_id: schedule.id,
                    lead_id: lead.id, email_account_id: account.id,
                    status: 'failed', updated_at: new Date().toISOString()
                 }, { onConflict: 'campaign_id,schedule_id,lead_id' });
             }
        }

        if (pendingLeads && pendingLeads.length > 0) {
            const nextSend = new Date(now.getTime() + (schedule.interval_minutes || 5) * 60000);
            await supabaseAdmin.from('scheduled_emails')
                .update({ scheduled_for: nextSend.toISOString() }).eq('id', schedule.id);
        }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
     return new Response(String(err?.message ?? err), { status: 500 });
  }
});
