import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function processBounces() {
    console.log("[Bounce Processor] Starting async bounce scan...");
    
    // Fetch all active email accounts
    const { data: accounts, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('status', 'active');

    if (error || !accounts || accounts.length === 0) {
        console.log("[Bounce Processor] No active email accounts found.");
        return;
    }

    for (const account of accounts) {
        if (!account.imap_host || !account.imap_port) {
            console.warn(`[Bounce Processor] Skipping ${account.email} - missing IMAP settings.`);
            continue;
        }

        console.log(`[Bounce Processor] Scanning ${account.email}...`);
        
        const client = new ImapFlow({
            host: account.imap_host,
            port: Number(account.imap_port),
            secure: Number(account.imap_port) === 993,
            auth: {
                user: account.email,
                pass: account.app_password || account.password
            },
            logger: false
        });

        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');
            
            try {
                // Search for typical bounce subjects or sender
                const searchCriteria = {
                    or: [
                        { subject: 'Undelivered Mail Returned to Sender' },
                        { subject: 'Delivery Status Notification (Failure)' },
                        { from: 'MAILER-DAEMON' },
                        { from: 'postmaster' }
                    ]
                };

                const messages = client.fetch(searchCriteria, { source: true, uid: true });
                let bounceCount = 0;

                for await (let msg of messages) {
                    try {
                        const parsed = await simpleParser(msg.source);
                        const body = parsed.text || '';
                        
                        let originalRecipient = null;
                        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                        const match = body.match(emailRegex);
                        if (match) {
                            const filtered = match.filter(e => e.toLowerCase() !== account.email.toLowerCase());
                            if (filtered.length > 0) {
                                originalRecipient = filtered[0].toLowerCase();
                            }
                        }

                        if (originalRecipient) {
                            console.log(`[Bounce Processor] Found bounce for: ${originalRecipient}`);
                            
                            await supabase
                                .from('leads')
                                .update({ status: 'bounced' })
                                .eq('email', originalRecipient);

                            // Delete the bounce email so we don't process it again
                            await client.messageDelete(msg.uid);
                            bounceCount++;
                        }
                    } catch (err) {
                        console.error(`[Bounce Processor] Failed to parse bounce message:`, err.message);
                    }
                }
                if (bounceCount > 0) {
                    console.log(`[Bounce Processor] Marked ${bounceCount} leads as bounced for ${account.email}.`);
                }
            } finally {
                lock.release();
            }
            await client.logout();
        } catch (error) {
            console.error(`[Bounce Processor] Error scanning ${account.email}:`, error.message);
        }
    }
    console.log("[Bounce Processor] Finished scan.");
}

// Allow standalone execution
if (process.argv[1] && process.argv[1].endsWith('bounce_processor_cron.mjs')) {
    processBounces().then(() => process.exit(0));
}

let isBounceProcessorRunning = false;
export function startBounceProcessorCron() {
    console.log('[SYSTEM] Starting Async Bounce Processor Cron (runs every 15 minutes)');
    setInterval(async () => {
        if (isBounceProcessorRunning) return;
        isBounceProcessorRunning = true;
        try {
            await processBounces();
        } catch (e) {
            console.error('[Bounce Processor] Fatal error:', e);
        } finally {
            isBounceProcessorRunning = false;
        }
    }, 15 * 60 * 1000); // 15 mins
    
    // Initial run
    setTimeout(() => {
        if (!isBounceProcessorRunning) {
            isBounceProcessorRunning = true;
            processBounces().finally(() => { isBounceProcessorRunning = false; });
        }
    }, 5000);
}
