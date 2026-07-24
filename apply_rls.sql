
-- 1. Add user_id to email_tones
ALTER TABLE email_tones ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE email_tones SET user_id = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1' WHERE user_id IS NULL;

-- 2. Enable RLS on core tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tones ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- 3. Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can manage own leads" ON leads;
DROP POLICY IF EXISTS "Users can manage own email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can manage own email_tones" ON email_tones;
DROP POLICY IF EXISTS "Users can manage own inbox_emails" ON inbox_emails;
DROP POLICY IF EXISTS "Users can manage own campaign_leads" ON campaign_leads;

-- 4. Create policies
CREATE POLICY "Users can manage own campaigns" ON campaigns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public leads are viewable by everyone" ON leads FOR SELECT USING (true);
CREATE POLICY "Users can manage own leads" ON leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own email_accounts" ON email_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own email_tones" ON email_tones FOR ALL USING (auth.uid() = user_id);

-- For inbox_emails, we check the email_account_id
CREATE POLICY "Users can manage own inbox_emails" ON inbox_emails FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM email_accounts ea 
    WHERE ea.id = inbox_emails.email_account_id 
    AND ea.user_id = auth.uid()
  )
);

-- For campaign_leads, we check the campaign_id
CREATE POLICY "Users can manage own campaign_leads" ON campaign_leads FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM campaigns c 
    WHERE c.id = campaign_leads.campaign_id 
    AND c.user_id = auth.uid()
  )
);
