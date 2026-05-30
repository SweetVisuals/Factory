const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const missingEmails = [
    {
        from: 'Aoife Sweeney <lachozabrighton@gmail.com>',
        to: 'Lucas <lucas@relaysolutions.net>',
        subject: 'Re: Quick question about La Choza',
        content: `Great thanks for asking\nSent from my iPhone`,
        received_at: '2026-02-23T16:54:00.000Z',
        emailMatch: 'lachozabrighton@gmail.com'
    },
    {
        from: 'Adrien Flores <adrien@spudstreetinc.com>',
        to: 'Kat <kat@relaysolutions.net>',
        subject: 'Re: Quick question about Spud Street',
        content: `What are you offering as a solution?`,
        received_at: '2026-02-24T07:08:00.000Z',
        emailMatch: 'adrien@spudstreetinc.com'
    },
    {
        from: 'Stoked Food <info@stokedfood.com>',
        to: 'Kat <kat@relaysolutions.net>',
        subject: 'Re: Quick question about Stoked Food',
        content: `Hi Kat,\nThanks for your email.\nTo be honest, we haven’t started looking into this yet, we will be soon tho.\nInterested to know what you offer.\n\nKind regards,\nJames Astle`,
        received_at: '2026-02-24T05:59:00.000Z',
        emailMatch: 'info@stokedfood.com'
    },
    {
        from: 'Magid assaleh <mgassaleh@gmail.com>',
        to: 'Ethan <ethan@relaysolutions.net>',
        subject: 'Re: Quick question about your Mediterranean restaurant',
        content: `As we did for 14 years\nSent from my iPhone`,
        received_at: '2026-02-23T19:18:00.000Z',
        emailMatch: 'mgassaleh@gmail.com'
    },
    {
        from: 'Jallow Black <pepponesstreetfood@gmail.com>',
        to: 'Nicolas <nicolas@relaysolutions.net>',
        subject: 'Re: Quick question about Peppones Street Food',
        content: `By organizing myself, working hard and knowing my menu very well`,
        received_at: '2026-02-23T15:43:00.000Z',
        emailMatch: 'pepponesstreetfood@gmail.com'
    },
    {
        from: 'Jallow Black <pepponesstreetfood@gmail.com>',
        to: 'Nicolas <nicolas@relaysolutions.net>',
        subject: 'Re: Quick question about Peppones Street Food',
        content: `I’m also looking to extend my opening hours, but, the bookings are taking most of my time \nHopefully this summer I will spend more time at the odiham canal`,
        received_at: '2026-02-23T15:44:00.000Z',
        emailMatch: 'pepponesstreetfood@gmail.com'
    }
];

async function insertMissing() {
    const { data: accounts } = await supabaseAdmin.from('email_accounts').select('id, email');

    for (const email of missingEmails) {
        // Find lead
        const { data: leadMatch } = await supabaseAdmin
            .from('leads')
            .select('id, status, campaign_leads!inner(campaign_id)')
            .ilike('email', email.emailMatch.trim().toLowerCase())
            .limit(1)
            .maybeSingle();

        if (leadMatch) {
            console.log(`Found lead for ${email.emailMatch}`);

            // Update lead to interested
            await supabaseAdmin.from('leads').update({ status: 'interested' }).eq('id', leadMatch.id);

            const toEmailStr = email.to.match(/<([^>]+)>/)?.[1] || email.to;
            const account = accounts.find(a => a.email.toLowerCase() === toEmailStr.toLowerCase());

            if (account) {
                const emailData = {
                    email_account_id: account.id,
                    uid: Math.floor(Math.random() * 1000000) + 9000000, // random fake uid just so it displays
                    folder: 'inbox',
                    from: email.from,
                    to: email.to,
                    subject: email.subject,
                    received_at: email.received_at,
                    snippet: email.content.substring(0, 100),
                    body_text: email.content,
                    body_html: null,
                    is_read: true,
                    campaign_id: leadMatch.campaign_leads[0].campaign_id
                };

                await supabaseAdmin.from('inbox_emails').insert(emailData);
                console.log(`Inserted email for ${email.emailMatch}`);
            } else {
                console.log(`Could not find email account for ${toEmailStr}`);
            }
        } else {
            console.log(`Lead not found for ${email.emailMatch}`);
        }
    }
}

insertMissing().catch(console.error);
