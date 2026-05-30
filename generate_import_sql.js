const fs = require('fs');

const data = JSON.parse(fs.readFileSync('relay_migration_data.json', 'utf8'));
const NEW_USER_ID = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';

function escape(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    return val;
}

const sqlChunks = [];

// Campaigns
if (data.campaigns.length > 0) {
    let sql = 'INSERT INTO public.campaigns (id, name, user_id, status, pitch, niche, schedule, created_at) VALUES ';
    sql += data.campaigns.map(c => `(${escape(c.id)}, ${escape(c.name)}, '${NEW_USER_ID}', ${escape(c.status)}, ${escape(c.pitch)}, ${escape(c.niche)}, ${escape(c.schedule)}, ${escape(c.created_at)})`).join(',');
    sql += ' ON CONFLICT (id) DO NOTHING;';
    sqlChunks.push(sql);
}

// Leads (Split into chunks of 200)
for (let i = 0; i < data.leads.length; i += 200) {
    const chunk = data.leads.slice(i, i + 200);
    let sql = 'INSERT INTO public.leads (id, user_id, email, name, company, title, phone, linkedin, industry, location, employees, company_news, personalized_email, summary, website, facebook, twitter, instagram, created_at) VALUES ';
    sql += chunk.map(l => `(${escape(l.id)}, '${NEW_USER_ID}', ${escape(l.email)}, ${escape(l.name)}, ${escape(l.company)}, ${escape(l.title)}, ${escape(l.phone)}, ${escape(l.linkedin)}, ${escape(l.industry)}, ${escape(l.location)}, ${escape(l.employees)}, ${escape(l.company_news)}, ${escape(l.personalized_email)}, ${escape(l.summary)}, ${escape(l.website)}, ${escape(l.facebook)}, ${escape(l.twitter)}, ${escape(l.instagram)}, ${escape(l.created_at)})`).join(',');
    sql += ' ON CONFLICT (id) DO NOTHING;';
    sqlChunks.push(sql);
}

// Campaign Leads
for (let i = 0; i < data.campaign_leads.length; i += 500) {
    const chunk = data.campaign_leads.slice(i, i + 500);
    let sql = 'INSERT INTO public.campaign_leads (campaign_id, lead_id) VALUES ';
    sql += chunk.map(cl => `(${escape(cl.campaign_id)}, ${escape(cl.lead_id)})`).join(',');
    sql += ' ON CONFLICT DO NOTHING;';
    sqlChunks.push(sql);
}

// Email Accounts
if (data.email_accounts.length > 0) {
    let sql = 'INSERT INTO public.email_accounts (id, user_id, email, name, signature, imap_host, imap_port, smtp_host, smtp_port, encrypted_password, warmup_enabled, warmup_filter_tag, warmup_increase_per_day, warmup_daily_limit, warmup_start_date, warmup_status, created_at) VALUES ';
    sql += data.email_accounts.map(e => `(${escape(e.id)}, '${NEW_USER_ID}', ${escape(e.email)}, ${escape(e.name)}, ${escape(e.signature)}, ${escape(e.imap_host)}, ${escape(e.imap_port)}, ${escape(e.smtp_host)}, ${escape(e.smtp_port)}, ${escape(e.encrypted_password)}, ${escape(e.warmup_enabled)}, ${escape(e.warmup_filter_tag)}, ${escape(e.warmup_increase_per_day)}, ${escape(e.warmup_daily_limit)}, ${escape(e.warmup_start_date)}, ${escape(e.warmup_status)}, ${escape(e.created_at)})`).join(',');
    sql += ' ON CONFLICT (id) DO NOTHING;';
    sqlChunks.push(sql);
}

// Warmup Progress
for (let i = 0; i < data.email_warmup_progress.length; i += 500) {
    const chunk = data.email_warmup_progress.slice(i, i + 500);
    let sql = 'INSERT INTO public.email_warmup_progress (id, email_account_id, date, emails_sent, emails_received, created_at) VALUES ';
    sql += chunk.map(w => `(${escape(w.id)}, ${escape(w.email_account_id)}, ${escape(w.date)}, ${escape(w.emails_sent)}, ${escape(w.emails_received)}, ${escape(w.created_at)})`).join(',');
    sql += ' ON CONFLICT (id) DO NOTHING;';
    sqlChunks.push(sql);
}

fs.writeFileSync('migration_queries.json', JSON.stringify(sqlChunks, null, 2));
console.log(`Generated ${sqlChunks.length} SQL queries for migration.`);
