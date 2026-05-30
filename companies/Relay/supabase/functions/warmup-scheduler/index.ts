
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.13';

// Recipient list
const WARMUP_RECIPIENTS = [
  'lowkeyvfx@gmail.com',
  'vosmusicbaby@gmail.com',
  'acedkmgmt@gmail.com',
  'nicolas@coldspark.org',
  'westleafeconomy2@gmail.com'
];

Deno.serve(async (req) => {
  // Use Service Role to bypass RLS and decrypt passwords
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting warmup run...");

  try {
    // 1. Fetch Active Warmup Accounts
    // We only want accounts that have warmup enabled
    const { data: rawAccounts, error: accountsError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('warmup_enabled', true);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    // Filter out MrMedic accounts
    const accounts = (rawAccounts || []).filter((account: any) => {
        const email = account.email?.toLowerCase() || '';
        if (email.includes('mrmedic') || email.includes('mrmedicevents.co.uk')) {
            console.log(`Warmup skipped for MrMedic account: ${email}`);
            return false;
        }
        return true;
    });
    
    console.log(`Found ${accounts.length} active non-MrMedic warmup accounts`);

    const results = [];

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
          try {
            // 2. Calculate Daily Limit (Ramp Up Logic)
            let effectiveLimit = account.warmup_daily_limit;
            if (account.warmup_start_date && account.warmup_increase_per_day > 0) {
                const startDate = new Date(account.warmup_start_date);
                const now = new Date();
                const diffTime = now.getTime() - startDate.getTime();
                const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                const calculatedLimit = (diffDays + 1) * account.warmup_increase_per_day;
                effectiveLimit = Math.min(account.warmup_daily_limit, calculatedLimit);
            }

            // 3. Calculate Interval
            // Calculate minimum time between emails to spread them evenly over 24h
            if (effectiveLimit <= 0) {
                results.push({ email: account.email, status: 'skipped', reason: 'Effective limit is 0' });
                continue;
            }

            const intervalMs = (24 * 60 * 60 * 1000) / effectiveLimit;
            
            const now = new Date();
            const lastSent = account.last_warmup_sent_at ? new Date(account.last_warmup_sent_at) : null;
            
            let shouldSend = false;
            
            // Check timing
            if (!lastSent) {
                shouldSend = true; // Never sent, send now
            } else {
                 const timeSinceLast = now.getTime() - lastSent.getTime();
                 const minutesSinceLast = Math.floor(timeSinceLast / 60000);
                 const intervalMinutes = Math.floor(intervalMs / 60000);
                 
                 console.log(`Account ${account.email}: Last sent ${minutesSinceLast}m ago. Interval needed: ${intervalMinutes}m.`);
                 
                 if (timeSinceLast >= intervalMs) {
                     shouldSend = true;
                 }
            }

            // Check if daily limit already reached
            // We must check 'email_warmup_progress' for today
            const today = now.toISOString().split('T')[0];
            const { data: todayStats } = await supabase
                .from('email_warmup_progress')
                .select('emails_sent')
                .eq('email_account_id', account.id)
                .eq('date', today)
                .single();
                
            const sentToday = todayStats?.emails_sent || 0;
            
            if (sentToday >= effectiveLimit) {
                console.log(`Account ${account.email}: Daily limit reached (${sentToday}/${effectiveLimit}). Skipping.`);
                shouldSend = false;
            }

            if (shouldSend) {
                console.log(`Account ${account.email}: Sending warmup email (${sentToday + 1}/${effectiveLimit})...`);
                
                // 4. Decrypt Password
                const { data: decryptedPassword, error: decryptError } = await supabase
                    .rpc('decrypt_password', {
                        encrypted_password: account.encrypted_password
                    });

                if (decryptError || !decryptedPassword) {
                     console.error(`Failed to decrypt password for ${account.email}`, decryptError);
                     results.push({ email: account.email, status: 'error', reason: 'Decryption failed' });
                     continue;
                }

                // Check domain email limit (max 50/hr per domain)
                const senderDomain = account.email.split('@')[1];
                if (senderDomain) {
                    const { data: canSend, error: limitError } = await supabase.rpc('increment_domain_email_count', {
                        p_domain: senderDomain.toLowerCase(),
                        p_max_limit: 50 // Default limit is 50/hour per domain
                    });
                    if (limitError) {
                        console.error("Domain limit check error:", limitError);
                    } else if (!canSend) {
                        console.warn(`Domain ${senderDomain} reached 50/hr limit. Skipping warmup send for ${account.email}.`);
                        results.push({ email: account.email, status: 'skipped', reason: 'Domain hourly limit reached' });
                        continue;
                    }
                }

                // 5. Send Email via SMTP
                const transporter = nodemailer.createTransport({
                    host: account.smtp_host,
                    port: account.smtp_port,
                    secure: Number(account.smtp_port) === 465, 
                    auth: {
                        user: account.email,
                        pass: decryptedPassword
                    }
                });

                const randomRecipient = WARMUP_RECIPIENTS[Math.floor(Math.random() * WARMUP_RECIPIENTS.length)];
                
                // Add variety to subjects and messages to avoid spam filters
                const subjects = [
                    `Quick sync regarding our discussion`,
                    `Follow up on our previous conversation`,
                    `Checking in on the project status`,
                    `Thoughts on the new proposal?`,
                    `Regarding the upcoming meeting`
                ];
                const baseSubject = subjects[Math.floor(Math.random() * subjects.length)];
                const filterTag = account.warmup_filter_tag || 'WARMUP';
                
                const messages = [
                    "Just wanted to follow up on our previous discussion and see if you had any updates.",
                    "Hope you're having a great week! Let me know when you have a moment to catch up.",
                    "I was just looking over the notes from our last sync. Everything seems to be on track.",
                    "Are you available for a brief call sometime later this week to discuss the next steps?",
                    "Thanks for the information you sent over earlier. It was very helpful for our planning."
                ];
                const message = messages[Math.floor(Math.random() * messages.length)];

                await transporter.sendMail({
                    from: account.name ? `"${account.name}" <${account.email}>` : account.email,
                    to: randomRecipient,
                    subject: `${baseSubject} - ${filterTag}`,
                    text: `${message}\n\nBest regards,\n${account.name || account.email.split('@')[0]}\n--\n${account.signature || ''}`
                });

                // 6. Update Stats
                await supabase.from('email_warmup_progress').upsert({
                    email_account_id: account.id,
                    date: today,
                    emails_sent: sentToday + 1
                }, { onConflict: 'email_account_id,date' });

                // 7. Update Last Sent Timestamp
                await supabase.from('email_accounts').update({
                    last_warmup_sent_at: now.toISOString()
                }).eq('id', account.id);

                results.push({ email: account.email, status: 'sent', recipient: randomRecipient });
                console.log(`Account ${account.email}: Sent successfully.`);

            } else {
                 results.push({ email: account.email, status: 'skipped', reason: 'Not time yet' });
            }
          } catch (err) {
            console.error(`Error processing account ${account.email}:`, err);
            results.push({ email: account.email, status: 'error', error: err.message });
          }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
      console.error("Global error:", err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
