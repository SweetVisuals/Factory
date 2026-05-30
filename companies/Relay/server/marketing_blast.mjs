import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function runMarketingBlast() {
  console.log('[Marketing Blast] Starting twice-a-month marketing blast run...');

  try {
    // 1. Fetch Relay Accounts
    const { data: accounts, error: accError } = await supabase
      .from('email_accounts')
      .select('*')
      .like('email', '%relay%');

    if (accError) throw new Error(`Error fetching Relay accounts: ${accError.message}`);
    if (!accounts || accounts.length === 0) {
      console.log('[Marketing Blast] No Relay accounts found. Exiting.');
      return;
    }

    // 2. Determine templates
    const getWebTemplate = (account) => {
      const subject = 'A quick word about your digital presence';
      const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin-bottom: 24px;">Hi there,</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">
          I'll keep this brief. We noticed your current website might not be capturing the full value of your brand. In today's market, a slow or outdated site actively costs you leads.
        </p>
        <p style="font-size: 16px; margin-bottom: 24px;">
          At <strong>Relay</strong>, we build high-end, lightning-fast web experiences designed to convert. No generic templates—just premium, bespoke development that turns visitors into clients.
        </p>
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 8px; color: #ffffff; margin-bottom: 24px; text-align: center;">
          <p style="font-size: 18px; font-weight: 600; margin: 0;">Are you open to a quick 5-minute chat to see what's possible?</p>
        </div>
        <p style="font-size: 16px; margin-bottom: 32px;">
          Best,<br/>
          <strong>${account.name || 'The Relay Team'}</strong><br/>
          Relay Solutions
        </p>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
          <p>You are receiving this email because we believe our services can help your business grow.</p>
          <p><a href="#" style="color: #3b82f6; text-decoration: none;">Unsubscribe</a> from future communications.</p>
        </div>
      </div>`;
      return { subject, html };
    };

    const getAiTemplate = (account) => {
      const subject = 'Automating your most time-consuming workflows';
      const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #e2e8f0; line-height: 1.6; background-color: #0f172a; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);">
        <h2 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-bottom: 24px;">Hi there,</h2>
        <p style="font-size: 16px; margin-bottom: 20px; color: #cbd5e1;">
          How many hours does your team spend on manual data entry, scheduling, or repetitive admin tasks every week?
        </p>
        <p style="font-size: 16px; margin-bottom: 24px; color: #cbd5e1;">
          At <strong>Relay</strong>, we specialize in building custom AI agents and workflow automations that eliminate busywork. We help businesses operate faster, leaner, and with fewer errors.
        </p>
        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
          <p style="font-size: 18px; font-weight: 600; margin: 0; color: #60a5fa;">Would you be open to exploring how AI could streamline your operations?</p>
        </div>
        <p style="font-size: 16px; margin-bottom: 32px; color: #cbd5e1;">
          Best,<br/>
          <strong style="color: #ffffff;">${account.name || 'The Relay Team'}</strong><br/>
          Relay Solutions
        </p>
        <div style="border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
          <p>You are receiving this email because we believe our AI services can significantly improve your efficiency.</p>
          <p><a href="#" style="color: #60a5fa; text-decoration: none;">Opt-out</a> of future emails.</p>
        </div>
      </div>`;
      return { subject, html };
    };

    // 3. Fetch Uncontacted Leads (using a placeholder filter, depending on how leads are structured in the DB)
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'new')
      .not('email', 'is', null)
      .limit(100); // Blast 100 per run

    if (leadError) throw new Error(`Error fetching leads: ${leadError.message}`);
    if (!leads || leads.length === 0) {
      console.log('[Marketing Blast] No uncontacted leads found.');
      return;
    }

    console.log(`[Marketing Blast] Preparing to send to ${leads.length} leads.`);

    let sentCount = 0;
    
    // Distribute among accounts and templates randomly
    for (const lead of leads) {
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const isWeb = Math.random() > 0.5;
      const template = isWeb ? getWebTemplate(account) : getAiTemplate(account);

      const { data: decryptedPassword } = await supabase.rpc('decrypt_password', {
        encrypted_password: account.encrypted_password
      });

      if (!decryptedPassword) continue;

      const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port,
        secure: Number(account.smtp_port) === 465,
        auth: { user: account.email, pass: decryptedPassword }
      });

      try {
        await transporter.sendMail({
          from: account.name ? \`"\${account.name}" <\${account.email}>\` : account.email,
          to: lead.email,
          subject: template.subject,
          html: template.html,
          text: template.html.replace(/<[^>]*>?/gm, '')
        });

        // Mark lead as contacted (update status so it doesn't get picked up again next time)
        await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id);
        sentCount++;
        
        console.log(`[Marketing Blast] Sent ${isWeb ? 'Web' : 'AI'} template to ${lead.email}`);
        
        // Slight delay to avoid SMTP rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`[Marketing Blast] Failed to send to ${lead.email}:`, err.message);
      }
    }

    console.log(`[Marketing Blast] Complete! Successfully sent ${sentCount} emails.`);

  } catch (error) {
    console.error('[Marketing Blast] Error:', error);
  }
}

runMarketingBlast();
