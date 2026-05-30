const { createClient } = require('@supabase/supabase-js');
const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sync() {
    console.log('Fetching email accounts...');
    const { data: emailAccounts } = await supabaseAdmin.from('email_accounts').select('*');

    for (const account of emailAccounts) {
        if (!account.imap_host) continue;
        console.log('Syncing account ' + account.email);
        const { data: decryptedPassword } = await supabaseAdmin.rpc('decrypt_password', { encrypted_password: account.encrypted_password });

        let client;
        try {
            client = new ImapFlow({
                host: account.imap_host,
                port: account.imap_port,
                secure: account.imap_port === 993,
                auth: { user: account.email, pass: decryptedPassword },
                logger: false
            });
            await client.connect();

            const fetchRecent = async (path, folderType) => {
                try {
                    let lock = await client.getMailboxLock(path);
                    try {
                        const status = await client.status(path, { messages: true });
                        const total = status.messages;
                        if (total === 0) return;

                        const fetchCount = 4000; // Grab last 4000 to be safe for late Feb
                        const start = Math.max(1, total - (fetchCount - 1));
                        const range = `${start}:*`;

                        console.log('Fetching ' + range + ' in ' + path + ' for ' + account.email);

                        for await (const message of client.fetch(range, { envelope: true, source: true, uid: true, flags: true })) {
                            const parsed = await simpleParser(message.source);
                            const isRead = message.flags && message.flags.has ? message.flags.has('\\Seen') : false;

                            const senderText = parsed.from?.text || '';
                            if (senderText.toLowerCase().includes('mailer-daemon')) continue;

                            let campaignIdMatch = parsed.headers.get('x-campaign-id') || null;

                            if (folderType === 'inbox') {
                                const senderEmail = parsed.from?.value?.[0]?.address || (parsed.from?.text || '').match(/<([^>]+)>/)?.[1] || parsed.from?.text;
                                if (senderEmail) {
                                    const cleanSenderEmail = senderEmail.trim().toLowerCase();
                                    try {
                                        const { data: leadMatch } = await supabaseAdmin
                                            .from('leads')
                                            .select('id, status, campaign_leads!inner(campaign_id)')
                                            .ilike('email', cleanSenderEmail)
                                            .limit(1)
                                            .maybeSingle();

                                        if (leadMatch?.campaign_leads?.[0]?.campaign_id) {
                                            if (!campaignIdMatch) campaignIdMatch = leadMatch.campaign_leads[0].campaign_id;

                                            // Set to interested immediately
                                            if (leadMatch.status !== 'closed' && leadMatch.status !== 'interested') {
                                                console.log('Marking lead ' + cleanSenderEmail + ' as interested!');
                                                await supabaseAdmin
                                                    .from('leads')
                                                    .update({ status: 'interested' })
                                                    .eq('id', leadMatch.id);
                                            }
                                        }
                                    } catch (e) { }
                                }
                            }

                            const emailData = {
                                email_account_id: account.id,
                                uid: message.uid,
                                folder: folderType,
                                from: parsed.from?.text || 'Unknown',
                                to: parsed.to?.text || 'Unknown',
                                subject: parsed.subject || '(No Subject)',
                                received_at: parsed.date || new Date(),
                                snippet: parsed.text ? parsed.text.substring(0, 100) : '',
                                body_text: parsed.text,
                                body_html: parsed.html || parsed.textAsHtml,
                                is_read: isRead,
                                campaign_id: campaignIdMatch
                            };

                            await supabaseAdmin
                                .from('inbox_emails')
                                .upsert(emailData, {
                                    onConflict: 'email_account_id,folder,uid'
                                });
                        }
                    } finally {
                        lock.release();
                    }
                } catch (e) {
                    console.log('error in fetchRecent for ' + path, e.message);
                }
            };

            await fetchRecent('INBOX', 'inbox');

            const listed = await client.list();
            const sentFolder = listed.find(f =>
                f.specialUse === '\\Sent' ||
                f.name === 'Sent' ||
                f.name === 'Sent Items' ||
                f.path === '[Gmail]/Sent Mail' ||
                f.path === 'INBOX.Sent'
            );

            if (sentFolder) {
                await fetchRecent(sentFolder.path, 'sent');
            }

            await client.logout();
        } catch (e) {
            console.log('error for account ' + account.email, e.message);
        }
    }
    console.log('Done sync!');
}
sync().catch(console.error);
