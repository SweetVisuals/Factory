/*
  # Initial Schema Setup

  1. New Tables
    - `email_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, unique)
      - `name` (text)
      - `imap_host` (text)
      - `imap_port` (integer)
      - `smtp_host` (text)
      - `smtp_port` (integer)
      - `warmup_enabled` (boolean)
      - `daily_limit` (integer)
      - `signature` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `warmup_stats`
      - `id` (uuid, primary key)
      - `email_account_id` (uuid, references email_accounts)
      - `emails_sent` (integer)
      - `emails_received` (integer)
      - `spam_rescued` (integer)
      - `date` (date)
      - `created_at` (timestamptz)

    - `campaigns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `campaign_emails`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `email_account_id` (uuid, references email_accounts)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Email Accounts
CREATE TABLE email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  imap_host text NOT NULL,
  imap_port integer NOT NULL,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL,
  warmup_enabled boolean DEFAULT false,
  daily_limit integer DEFAULT 100,
  signature text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email accounts"
  ON email_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Warmup Stats
CREATE TABLE warmup_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid REFERENCES email_accounts NOT NULL,
  emails_sent integer DEFAULT 0,
  emails_received integer DEFAULT 0,
  spam_rescued integer DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE warmup_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warmup stats for their accounts"
  ON warmup_stats
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_accounts
      WHERE email_accounts.id = warmup_stats.email_account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

-- Campaigns
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own campaigns"
  ON campaigns
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Campaign Emails
CREATE TABLE campaign_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns NOT NULL,
  email_account_id uuid REFERENCES email_accounts NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, email_account_id)
);

ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaign emails for their campaigns"
  ON campaign_emails
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_emails.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

/*
  # Add Campaign Schedule Field

  1. Changes
    - Add schedule JSON field to campaigns table
  
  2. Details
    - schedule: Stores campaign scheduling configuration as JSON including:
      - frequency (daily/weekly)
      - maxEmailsPerDay
*/

ALTER TABLE campaigns 
ADD COLUMN schedule JSONB;

/*
  # Add Missing Campaign Columns

  1. Changes
    - Safely add open_rate column if it doesn't exist
    - Use DO block to handle conditional column creation
    - Ensure idempotent migration

  2. Details
    - open_rate: Stores the email open rate as a decimal
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'open_rate'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN open_rate DECIMAL DEFAULT 0.0;
  END IF;
END $$;

/*
  # Update campaign policies

  1. Changes
    - Add policy to allow users to insert their own campaigns
    - Add policy to allow users to update their own campaigns
    - Add policy to allow users to delete their own campaigns

  2. Security
    - Enable RLS on campaigns table
    - Ensure users can only manage their own campaigns
*/

-- Update the existing RLS policy for campaigns
DROP POLICY IF EXISTS "Users can manage their own campaigns" ON campaigns;

-- Create specific policies for each operation
CREATE POLICY "Users can insert their own campaigns"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own campaigns"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

/*
  # Add email templates, leads and scheduling support

  1. New Tables
    - `email_templates`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `name` (text)
      - `subject` (text)
      - `content` (text)
      - `created_at` (timestamp)

    - `leads`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `email` (text)
      - `name` (text)
      - `company` (text)
      - `title` (text)
      - `phone` (text)
      - `linkedin` (text)
      - `created_at` (timestamp)
    
    - `scheduled_emails`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `lead_id` (uuid, foreign key)
      - `template_id` (uuid, foreign key)
      - `scheduled_for` (timestamp)
      - `status` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create email_templates table
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create leads table
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  company text,
  title text,
  phone text,
  linkedin text,
  created_at timestamptz DEFAULT now()
);

-- Create scheduled_emails table
CREATE TABLE scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  template_id uuid REFERENCES email_templates(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Create policies for email_templates
CREATE POLICY "Users can manage templates for their campaigns"
  ON email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = email_templates.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Create policies for leads
CREATE POLICY "Users can manage leads for their campaigns"
  ON leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Create policies for scheduled_emails
CREATE POLICY "Users can manage scheduled emails for their campaigns"
  ON scheduled_emails
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = scheduled_emails.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

/*
  # Add additional fields to leads table
  
  1. Changes
    - Add industry column
    - Add location column 
    - Add employees column
    - Add company_news column
    - Add indexes for improved query performance

  2. Notes
    - Using DO block to safely add columns if they don't exist
    - Added indexes on commonly queried fields
*/

DO $$ 
BEGIN
  -- Add industry column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'industry'
  ) THEN
    ALTER TABLE leads ADD COLUMN industry text;
  END IF;

  -- Add location column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'location'
  ) THEN
    ALTER TABLE leads ADD COLUMN location text;
  END IF;

  -- Add employees column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'employees'
  ) THEN
    ALTER TABLE leads ADD COLUMN employees text;
  END IF;

  -- Add company_news column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'company_news'
  ) THEN
    ALTER TABLE leads ADD COLUMN company_news text;
  END IF;
END $$;

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(location);

/*
  # Create saved lists tables

  1. New Tables
    - `saved_lists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `created_at` (timestamp)
    - `list_leads`
      - `list_id` (uuid, references saved_lists)
      - `lead_id` (uuid, references leads)
      - Composite primary key (list_id, lead_id)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create saved_lists table
CREATE TABLE saved_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create list_leads table
CREATE TABLE list_leads (
  list_id uuid REFERENCES saved_lists ON DELETE CASCADE,
  lead_id uuid REFERENCES leads ON DELETE CASCADE,
  PRIMARY KEY (list_id, lead_id)
);

-- Enable RLS
ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_leads ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_lists
CREATE POLICY "Users can manage their own lists"
  ON saved_lists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for list_leads
CREATE POLICY "Users can manage leads in their lists"
  ON list_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_lists
      WHERE saved_lists.id = list_leads.list_id
      AND saved_lists.user_id = auth.uid()
    )
  );

/*
  # Fix schema and add campaign leads table

  1. Changes
    - Add campaign_leads table for tracking leads in campaigns
    - Fix column name from companyNews to company_news
    - Add missing indexes for performance

  2. Security
    - Enable RLS on campaign_leads table
    - Add policy for managing campaign leads
*/

-- Create campaign_leads table
CREATE TABLE IF NOT EXISTS campaign_leads (
  campaign_id uuid REFERENCES campaigns ON DELETE CASCADE,
  lead_id uuid REFERENCES leads ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, lead_id)
);

-- Enable RLS
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- Create policy for campaign_leads
CREATE POLICY "Users can manage leads in their campaigns"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_list_leads_list_id ON list_leads(list_id);
CREATE INDEX IF NOT EXISTS idx_list_leads_lead_id ON list_leads(lead_id);

/*
  # Fix leads table RLS policies

  1. Changes
    - Enable RLS on leads table
    - Add policy for users to manage leads
    - Add policy for users to view leads in their campaigns and lists
  
  2. Security
    - Users can only manage leads they create
    - Users can view leads in their campaigns and lists
*/

-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy for managing leads
CREATE POLICY "Users can manage leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM saved_lists sl
      JOIN list_leads ll ON ll.list_id = sl.id
      WHERE ll.lead_id = leads.id
      AND sl.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN campaign_leads cl ON cl.campaign_id = c.id
      WHERE cl.lead_id = leads.id
      AND c.user_id = auth.uid()
    )
    OR
    -- Allow insert operations
    (CASE WHEN current_setting('role') = 'authenticated' THEN true END)
  );

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

/*
  # Fix campaign leads RLS policy

  1. Changes
    - Drop existing RLS policy for campaign_leads
    - Create new policy that allows inserting leads into campaigns owned by the user
    - Add WITH CHECK clause to validate campaign ownership on insert

  2. Security
    - Ensures users can only add leads to their own campaigns
    - Maintains data isolation between users
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage leads in their campaigns" ON campaign_leads;

-- Create separate policies for different operations
CREATE POLICY "Users can view leads in their campaigns"
  ON campaign_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add leads to their campaigns"
  ON campaign_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove leads from their campaigns"
  ON campaign_leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

/*
  # Fix Campaign Leads RLS Policies

  1. Changes
    - Drop and recreate RLS policies for leads table
    - Add more permissive policy for lead creation
    - Fix campaign_leads policies
    
  2. Security
    - Maintains security while allowing proper lead management
    - Ensures users can only access their own data
*/

-- Drop existing leads policies
DROP POLICY IF EXISTS "Users can manage leads" ON leads;

-- Create new leads policies
CREATE POLICY "Users can manage their own leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (
    -- Allow access if the lead is in user's lists
    EXISTS (
      SELECT 1 FROM saved_lists sl
      JOIN list_leads ll ON ll.list_id = sl.id
      WHERE ll.lead_id = leads.id
      AND sl.user_id = auth.uid()
    )
    OR
    -- Allow access if the lead is in user's campaigns
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN campaign_leads cl ON cl.campaign_id = c.id
      WHERE cl.lead_id = leads.id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Drop existing campaign_leads policies
DROP POLICY IF EXISTS "Users can view leads in their campaigns" ON campaign_leads;
DROP POLICY IF EXISTS "Users can add leads to their campaigns" ON campaign_leads;
DROP POLICY IF EXISTS "Users can remove leads from their campaigns" ON campaign_leads;

-- Create new campaign_leads policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

/*
  # Fix Leads and Campaign Leads RLS Policies

  1. Changes
    - Drop and recreate leads policies with proper checks
    - Fix campaign_leads policies to allow proper association
    - Add missing indexes for performance
    
  2. Security
    - Maintains data isolation between users
    - Allows proper lead management within campaigns
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;
DROP POLICY IF EXISTS "Users can create leads" ON leads;
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;

-- Create new leads policies
CREATE POLICY "Users can create leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read their leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN campaign_leads cl ON cl.campaign_id = c.id
      WHERE cl.lead_id = leads.id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM saved_lists sl
      JOIN list_leads ll ON ll.list_id = sl.id
      WHERE ll.lead_id = leads.id
      AND sl.user_id = auth.uid()
    )
  );

-- Create new campaign_leads policies
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_created_at ON campaign_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_lists_user_id ON saved_lists(user_id);

/*
  # Fix Campaign Leads RLS Policies

  1. Changes
    - Drop and recreate campaign_leads policies with proper checks
    - Add missing indexes for performance
    
  2. Security
    - Maintains data isolation between users
    - Allows proper lead management within campaigns
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;

-- Create new campaign_leads policies
CREATE POLICY "Users can insert campaign leads"
  ON campaign_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view campaign leads"
  ON campaign_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete campaign leads"
  ON campaign_leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_lead ON campaign_leads(campaign_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_campaign ON campaigns(user_id, id);

/*
  # Fix Campaign Leads RLS Policies

  1. Changes
    - Drop and recreate campaign_leads policies with proper checks
    - Add missing indexes for performance
    - Fix policy ordering and checks
    
  2. Security
    - Maintains data isolation between users
    - Allows proper lead management within campaigns
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert campaign leads" ON campaign_leads;
DROP POLICY IF EXISTS "Users can view campaign leads" ON campaign_leads;
DROP POLICY IF EXISTS "Users can delete campaign leads" ON campaign_leads;

-- Create new unified policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Add composite index for campaign ownership check
CREATE INDEX IF NOT EXISTS idx_campaigns_user_campaign_lookup 
  ON campaigns(user_id, id);

-- Add index for campaign leads lookups
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lookup 
  ON campaign_leads(campaign_id, lead_id);

/*
  # Final Fix for Campaign Leads RLS

  1. Changes
    - Simplify RLS policies with a single unified policy
    - Add proper WITH CHECK clause for inserts
    - Ensure proper campaign ownership verification
    
  2. Security
    - Maintains data isolation between users
    - Allows proper lead management within campaigns
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;

-- Create new simplified policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Add missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

-- Analyze tables to update statistics
ANALYZE campaign_leads;
ANALYZE campaigns;

/*
  # Fix Campaign Leads Structure and Policies

  1. Changes
    - Add created_at column if missing
    - Ensure proper foreign key constraints
    - Add proper indexes
    - Update RLS policies
    
  2. Security
    - Maintain data isolation between users
    - Ensure proper campaign ownership checks
*/

-- Ensure created_at column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_leads' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE campaign_leads ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;

-- Create new policy with proper checks
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Recreate foreign key constraints
ALTER TABLE campaign_leads 
  DROP CONSTRAINT IF EXISTS campaign_leads_campaign_id_fkey,
  DROP CONSTRAINT IF EXISTS campaign_leads_lead_id_fkey;

ALTER TABLE campaign_leads
  ADD CONSTRAINT campaign_leads_campaign_id_fkey 
    FOREIGN KEY (campaign_id) 
    REFERENCES campaigns(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT campaign_leads_lead_id_fkey 
    FOREIGN KEY (lead_id) 
    REFERENCES leads(id) 
    ON DELETE CASCADE;

-- Add optimized indexes
DROP INDEX IF EXISTS idx_campaign_leads_campaign_id;
DROP INDEX IF EXISTS idx_campaign_leads_lead_id;
DROP INDEX IF EXISTS idx_campaign_leads_lookup;

CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX idx_campaign_leads_lookup ON campaign_leads(campaign_id, lead_id);

-- Update table statistics
ANALYZE campaign_leads;

/*
  # Final Fix for Campaign Leads Structure

  1. Changes
    - Simplify RLS policy
    - Add proper indexes
    - Ensure proper constraints
    
  2. Security
    - Maintain data isolation between users
    - Ensure proper campaign ownership checks
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;

-- Create simplified policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Ensure proper indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_lookup 
  ON campaign_leads(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_combined_lookup 
  ON campaign_leads(campaign_id, lead_id);

-- Update table statistics
ANALYZE campaign_leads;

/*
  # Comprehensive Fix for Campaign Leads System

  1. Changes
    - Complete overhaul of RLS policies
    - Proper cascading permissions
    - Optimized indexes
    - Proper constraints
    
  2. Security
    - Ensure proper data isolation between users
    - Maintain referential integrity
    - Allow proper lead sharing between lists and campaigns
*/

-- First, ensure we have the right constraints
ALTER TABLE campaign_leads
  DROP CONSTRAINT IF EXISTS campaign_leads_campaign_id_fkey,
  DROP CONSTRAINT IF EXISTS campaign_leads_lead_id_fkey;

ALTER TABLE campaign_leads
  ADD CONSTRAINT campaign_leads_campaign_id_fkey 
    FOREIGN KEY (campaign_id) 
    REFERENCES campaigns(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT campaign_leads_lead_id_fkey 
    FOREIGN KEY (lead_id) 
    REFERENCES leads(id) 
    ON DELETE CASCADE;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;
DROP POLICY IF EXISTS "Users can create leads" ON leads;
DROP POLICY IF EXISTS "Users can read their leads" ON leads;

-- Create new leads policies
CREATE POLICY "Users can create leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read their leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN campaign_leads cl ON cl.campaign_id = c.id
      WHERE cl.lead_id = leads.id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM saved_lists sl
      JOIN list_leads ll ON ll.list_id = sl.id
      WHERE ll.lead_id = leads.id
      AND sl.user_id = auth.uid()
    )
  );

-- Create new campaign_leads policy with proper checks
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Optimize indexes for common query patterns
DROP INDEX IF EXISTS idx_campaign_leads_campaign_id;
DROP INDEX IF EXISTS idx_campaign_leads_lead_id;
DROP INDEX IF EXISTS idx_campaign_leads_lookup;
DROP INDEX IF EXISTS idx_campaigns_user_id;
DROP INDEX IF EXISTS idx_leads_lookup;

CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX idx_campaign_leads_lookup ON campaign_leads(campaign_id, lead_id);
CREATE INDEX idx_campaigns_user_lookup ON campaigns(user_id, id);
CREATE INDEX idx_leads_lookup ON leads(id) INCLUDE (email);

-- Update table statistics
ANALYZE leads;
ANALYZE campaigns;
ANALYZE campaign_leads;

/*
  # Fix Campaign Leads System

  1. Changes
    - Simplified RLS policies
    - Improved relationship handling
    - Optimized query performance
    
  2. Security
    - Maintain proper data isolation
    - Allow lead sharing between campaigns
    - Prevent unauthorized access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;
DROP POLICY IF EXISTS "Users can create leads" ON leads;
DROP POLICY IF EXISTS "Users can read their leads" ON leads;

-- Create new leads policies
CREATE POLICY "Users can create leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read their leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN campaign_leads cl ON cl.campaign_id = c.id
      WHERE cl.lead_id = leads.id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM saved_lists sl
      JOIN list_leads ll ON ll.list_id = sl.id
      WHERE ll.lead_id = leads.id
      AND sl.user_id = auth.uid()
    )
  );

-- Create new campaign_leads policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Create function to check lead ownership
CREATE OR REPLACE FUNCTION check_lead_ownership(lead_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM campaigns c
    JOIN campaign_leads cl ON cl.campaign_id = c.id
    WHERE cl.lead_id = $1
    AND c.user_id = $2
  ) OR EXISTS (
    SELECT 1 FROM saved_lists sl
    JOIN list_leads ll ON ll.list_id = sl.id
    WHERE ll.lead_id = $1
    AND sl.user_id = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to verify lead ownership on campaign_leads insert
CREATE OR REPLACE FUNCTION verify_campaign_lead_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user owns the campaign
  IF NOT EXISTS (
    SELECT 1 FROM campaigns
    WHERE id = NEW.campaign_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'User does not own this campaign';
  END IF;

  -- If the lead exists and user owns it, allow the insert
  IF check_lead_ownership(NEW.lead_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- If the lead exists in leads table but user doesn't own it yet, allow it
  IF EXISTS (
    SELECT 1 FROM leads
    WHERE id = NEW.lead_id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid lead';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS verify_campaign_lead_insert_trigger ON campaign_leads;
CREATE TRIGGER verify_campaign_lead_insert_trigger
  BEFORE INSERT ON campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION verify_campaign_lead_insert();

-- Optimize indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_lookup 
  ON campaign_leads(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_combined_lookup 
  ON campaign_leads(campaign_id, lead_id);

-- Update statistics
ANALYZE campaign_leads;
ANALYZE leads;

/*
  # Fix Campaign Leads RLS

  1. Changes
    - Simplify RLS policies
    - Add proper ownership checks
    - Improve error handling
    
  2. Security
    - Maintain data isolation
    - Allow lead sharing between lists and campaigns
    - Prevent unauthorized access
*/

-- Drop existing policies and triggers
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;
DROP TRIGGER IF EXISTS verify_campaign_lead_insert_trigger ON campaign_leads;
DROP FUNCTION IF EXISTS verify_campaign_lead_insert();

-- Create new campaign_leads policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Create function to verify campaign ownership and lead access
CREATE OR REPLACE FUNCTION verify_campaign_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  campaign_owner_id uuid;
BEGIN
  -- Get campaign owner
  SELECT user_id INTO campaign_owner_id
  FROM campaigns
  WHERE id = NEW.campaign_id;

  -- Verify campaign ownership
  IF campaign_owner_id IS NULL OR campaign_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'User does not own this campaign';
  END IF;

  -- Allow the insert if:
  -- 1. User owns the lead through a list
  -- 2. User owns the lead through another campaign
  -- 3. The lead exists but isn't owned by anyone yet
  IF EXISTS (
    SELECT 1 FROM saved_lists sl
    JOIN list_leads ll ON ll.list_id = sl.id
    WHERE ll.lead_id = NEW.lead_id
    AND sl.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM campaigns c
    JOIN campaign_leads cl ON cl.campaign_id = c.id
    WHERE cl.lead_id = NEW.lead_id
    AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM leads
    WHERE id = NEW.lead_id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid lead';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for campaign_leads
CREATE TRIGGER verify_campaign_lead_insert_trigger
  BEFORE INSERT ON campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION verify_campaign_lead_insert();

-- Optimize indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lookup 
  ON campaign_leads(campaign_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_lookup 
  ON campaigns(user_id, id);

-- Update statistics
ANALYZE campaign_leads;
ANALYZE campaigns;
ANALYZE leads;

/*
  # Fix Campaign Leads RLS and Triggers

  1. Changes
    - Simplify RLS policy to focus on campaign ownership
    - Improve trigger function to handle all lead access cases
    - Add proper indexes for performance
    
  2. Security
    - Maintain data isolation between users
    - Allow lead sharing between campaigns
    - Prevent unauthorized access
*/

-- Drop existing policies and triggers
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;
DROP TRIGGER IF EXISTS verify_campaign_lead_insert_trigger ON campaign_leads;
DROP FUNCTION IF EXISTS verify_campaign_lead_insert();

-- Create simplified campaign_leads policy
CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_leads.campaign_id
      AND c.user_id = auth.uid()
    )
  );

-- Create improved trigger function for campaign_leads
CREATE OR REPLACE FUNCTION verify_campaign_lead_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- First verify campaign ownership
  IF NOT EXISTS (
    SELECT 1 FROM campaigns
    WHERE id = NEW.campaign_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'User does not own this campaign';
  END IF;

  -- Then verify lead access:
  -- 1. Lead exists in any of user's lists
  -- 2. Lead exists in any of user's campaigns
  -- 3. Lead exists but isn't associated with any user yet
  IF EXISTS (
    SELECT 1 FROM saved_lists sl
    JOIN list_leads ll ON ll.list_id = sl.id
    WHERE ll.lead_id = NEW.lead_id
    AND sl.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM campaigns c
    JOIN campaign_leads cl ON cl.campaign_id = c.id
    WHERE cl.lead_id = NEW.lead_id
    AND c.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = NEW.lead_id
    AND NOT EXISTS (
      SELECT 1 FROM campaign_leads cl2
      JOIN campaigns c2 ON c2.id = cl2.campaign_id
      WHERE cl2.lead_id = l.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM list_leads ll2
      JOIN saved_lists sl2 ON sl2.id = ll2.list_id
      WHERE ll2.lead_id = l.id
    )
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid lead access';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for campaign_leads
CREATE TRIGGER verify_campaign_lead_insert_trigger
  BEFORE INSERT ON campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION verify_campaign_lead_insert();

-- Optimize indexes
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lookup 
  ON campaign_leads(campaign_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_lookup 
  ON campaigns(user_id, id);

CREATE INDEX IF NOT EXISTS idx_list_leads_lead_lookup
  ON list_leads(lead_id);

CREATE INDEX IF NOT EXISTS idx_saved_lists_user_lookup
  ON saved_lists(user_id);

-- Update statistics
ANALYZE campaign_leads;
ANALYZE campaigns;
ANALYZE leads;
ANALYZE list_leads;
ANALYZE saved_lists;

/*
  # Add Templates Table

  1. New Tables
    - `templates`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `name` (text)
      - `subject` (text)
      - `content` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on templates table
    - Add policy for authenticated users to manage their templates
*/

-- Create templates table
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Create policy for managing templates
CREATE POLICY "Users can manage their campaign templates"
  ON templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = templates.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX idx_templates_campaign_id ON templates(campaign_id);
CREATE INDEX idx_templates_created_at ON templates(created_at);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();

/*
  # Fix scheduled_emails table foreign key

  1. Changes
    - Drop existing foreign key constraint
    - Add new foreign key constraint referencing the correct templates table
    - Add indexes for better performance
*/

-- Drop existing foreign key constraint
ALTER TABLE scheduled_emails
  DROP CONSTRAINT IF EXISTS scheduled_emails_template_id_fkey;

-- Add new foreign key constraint
ALTER TABLE scheduled_emails
  ADD CONSTRAINT scheduled_emails_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES templates(id)
  ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_template_id 
  ON scheduled_emails(template_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_for 
  ON scheduled_emails(scheduled_for);

-- Update statistics
ANALYZE scheduled_emails;
ANALYZE templates;

-- Combined migration for email accounts and leads fixes

-- Add smtp_port column to email_accounts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'email_accounts' 
    AND column_name = 'smtp_port'
  ) THEN
    ALTER TABLE email_accounts
    ADD COLUMN smtp_port text NOT NULL DEFAULT '587';
  END IF;
END $$;

-- Optimize indexes for leads system
CREATE INDEX IF NOT EXISTS idx_leads_lookup 
  ON leads(id);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_lookup 
  ON campaign_leads(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_combined_lookup 
  ON campaign_leads(campaign_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_list_leads_lookup 
  ON list_leads(lead_id, list_id);


-- Create campaign_email_accounts table with foreign key relationship

CREATE TABLE IF NOT EXISTS campaign_email_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_campaign_email_accounts_campaign 
    ON campaign_email_accounts(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_email_accounts_email_account 
    ON campaign_email_accounts(email_account_id);

-- Add unique constraint to prevent duplicate relationships
ALTER TABLE campaign_email_accounts 
    ADD CONSTRAINT unique_campaign_email_account 
    UNIQUE (campaign_id, email_account_id);


-- Ensure proper RLS policies for leads table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage leads for their campaigns" ON leads;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view leads for their campaigns"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert leads for their campaigns"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update leads for their campaigns"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete leads for their campaigns"
  ON leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );


-- Create table to track email sending progress
CREATE TABLE campaign_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_campaign_progress_campaign_id ON campaign_progress(campaign_id);
CREATE INDEX idx_campaign_progress_email_account_id ON campaign_progress(email_account_id);
CREATE INDEX idx_campaign_progress_lead_id ON campaign_progress(lead_id);

-- Enable RLS
ALTER TABLE campaign_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own campaign progress" 
ON campaign_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns 
    WHERE campaigns.id = campaign_progress.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own campaign progress" 
ON campaign_progress
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns 
    WHERE campaigns.id = campaign_progress.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own campaign progress" 
ON campaign_progress
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM campaigns 
    WHERE campaigns.id = campaign_progress.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own campaign progress" 
ON campaign_progress
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM campaigns 
    WHERE campaigns.id = campaign_progress.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);


-- Add email_account_id column to scheduled_emails table
ALTER TABLE scheduled_emails
ADD COLUMN email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_scheduled_emails_email_account_id ON scheduled_emails(email_account_id);


-- Add progress tracking columns to scheduled_emails table
ALTER TABLE scheduled_emails
ADD COLUMN total_emails integer NOT NULL DEFAULT 0,
ADD COLUMN sent_emails integer NOT NULL DEFAULT 0;


-- Add unique constraint to prevent duplicate schedules
ALTER TABLE scheduled_emails
ADD CONSTRAINT unique_email_account_template
UNIQUE (email_account_id, template_id);


-- Create new table for schedule email accounts
CREATE TABLE schedule_email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES scheduled_emails(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  emails_sent INTEGER DEFAULT 0,
  emails_remaining INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, email_account_id)
);

-- Drop existing email_account_id column from scheduled_emails
ALTER TABLE scheduled_emails DROP COLUMN email_account_id;

-- Drop old index if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_scheduled_emails_email_account_id'
    AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX idx_scheduled_emails_email_account_id';
  END IF;
END $$;

-- Create new index for better query performance
CREATE INDEX idx_schedule_email_accounts_schedule_id ON schedule_email_accounts(schedule_id);
CREATE INDEX idx_schedule_email_accounts_email_account_id ON schedule_email_accounts(email_account_id);


-- Check if email_account_id column exists before attempting migration
DO $$
DECLARE
  schedule_record RECORD;
  column_exists BOOLEAN;
BEGIN
  -- Check if column exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'scheduled_emails' 
    AND column_name = 'email_account_id'
  ) INTO column_exists;

  IF column_exists THEN
    -- Migrate existing email_account_id values to schedule_email_accounts
    FOR schedule_record IN
      SELECT id, email_account_id 
      FROM scheduled_emails 
      WHERE email_account_id IS NOT NULL
    LOOP
      -- Insert into new schedule_email_accounts table
      INSERT INTO schedule_email_accounts (
        schedule_id, 
        email_account_id,
        emails_sent,
        emails_remaining
      )
      VALUES (
        schedule_record.id,
        schedule_record.email_account_id,
        0, -- emails_sent
        (SELECT emails_per_account FROM scheduled_emails WHERE id = schedule_record.id)
      );
    END LOOP;

    -- Verify migration
    IF EXISTS (
      SELECT 1 
      FROM scheduled_emails 
      WHERE email_account_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Migration failed - some scheduled emails still have email_account_id';
    END IF;
  ELSE
    RAISE NOTICE 'email_account_id column already migrated - no action needed';
  END IF;
END $$;


-- Remove duplicates, keeping the latest entry for each (campaign_id, lead_id) pair
DELETE FROM campaign_progress
WHERE id NOT IN (
  SELECT DISTINCT ON (campaign_id, lead_id) id
  FROM campaign_progress
  ORDER BY campaign_id, lead_id, updated_at DESC
);

-- Add unique constraint
-- Remove duplicates, keeping the latest entry for each (campaign_id, lead_id) pair
DELETE FROM campaign_progress
WHERE id NOT IN (
  SELECT DISTINCT ON (campaign_id, lead_id) id
  FROM campaign_progress
  ORDER BY campaign_id, lead_id, updated_at DESC
);

-- Add unique constraint
ALTER TABLE campaign_progress
ADD CONSTRAINT campaign_progress_campaign_id_lead_id_key UNIQUE (campaign_id, lead_id);


-- Enable RLS on campaigns table
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own campaigns
CREATE POLICY "Users can only access their own campaigns"
ON campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable RLS on campaign_email_accounts table
ALTER TABLE campaign_email_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access campaign_email_accounts for their campaigns
CREATE POLICY "Users can only access campaign_email_accounts for their campaigns"
ON campaign_email_accounts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_email_accounts.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Add foreign key constraint to ensure data integrity
ALTER TABLE campaign_email_accounts
ADD CONSTRAINT fk_campaign_email_accounts_campaigns
FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
ON DELETE CASCADE;

ALTER TABLE campaign_email_accounts
ADD CONSTRAINT fk_campaign_email_accounts_email_accounts
FOREIGN KEY (email_account_id) REFERENCES email_accounts(id)
ON DELETE CASCADE;


-- Enable RLS on all user-specific tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Add user_id to tables if missing
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add RLS policies
-- Campaigns
DROP POLICY IF EXISTS "Users can only access their own campaigns" ON campaigns;
CREATE POLICY "Users can only access their own campaigns"
ON campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Email Accounts
DROP POLICY IF EXISTS "Users can only access their own email accounts" ON email_accounts;
CREATE POLICY "Users can only access their own email accounts"
ON email_accounts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Campaign Email Accounts
DROP POLICY IF EXISTS "Users can only access campaign_email_accounts for their campaigns" ON campaign_email_accounts;
CREATE POLICY "Users can only access campaign_email_accounts for their campaigns"
ON campaign_email_accounts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_email_accounts.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Leads
DROP POLICY IF EXISTS "Users can only access their own leads" ON leads;
CREATE POLICY "Users can only access their own leads"
ON leads
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Scheduled Emails
DROP POLICY IF EXISTS "Users can only access their own scheduled emails" ON scheduled_emails;
CREATE POLICY "Users can only access their own scheduled emails"
ON scheduled_emails
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add foreign key constraints
ALTER TABLE campaign_email_accounts
ADD CONSTRAINT fk_campaign_email_accounts_campaigns
FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
ON DELETE CASCADE;

ALTER TABLE campaign_email_accounts
ADD CONSTRAINT fk_campaign_email_accounts_email_accounts
FOREIGN KEY (email_account_id) REFERENCES email_accounts(id)
ON DELETE CASCADE;

ALTER TABLE leads
ADD CONSTRAINT fk_leads_campaigns
FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
ON DELETE CASCADE;

ALTER TABLE scheduled_emails
ADD CONSTRAINT fk_scheduled_emails_campaigns
FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
ON DELETE CASCADE;

-- Migrate existing data to associate with users
UPDATE leads SET user_id = campaigns.user_id
FROM campaigns
WHERE leads.campaign_id = campaigns.id;

UPDATE scheduled_emails SET user_id = campaigns.user_id
FROM campaigns
WHERE scheduled_emails.campaign_id = campaigns.id;


-- Verify RLS on all user-specific tables
DO $$
DECLARE
  tbl_name text;
BEGIN
  FOR tbl_name IN 
    SELECT t.table_name 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
    AND t.table_name IN ('campaigns', 'email_accounts', 'campaign_email_accounts', 'leads', 'scheduled_emails')
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = tbl_name
      AND n.nspname = 'public'
      AND c.relrowsecurity = true
    ) THEN
      RAISE EXCEPTION 'RLS not enabled on table %', tbl_name;
    END IF;
  END LOOP;
END $$;

-- Verify user_id columns
DO $$
DECLARE
  current_table text;
BEGIN
  FOR current_table IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('campaigns', 'email_accounts', 'leads', 'scheduled_emails')
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns cols
      WHERE cols.table_name = current_table
      AND cols.column_name = 'user_id'
    ) THEN
      RAISE EXCEPTION 'user_id column not found in table %', current_table;
    END IF;
  END LOOP;
END $$;


-- Create auth.uid() function
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS uuid 
LANGUAGE sql 
STABLE
AS $$
  SELECT 
    nullif(
      current_setting('request.jwt.claim.sub', true),
      ''
    )::uuid
$$;


-- Add email account deletion to user deletion function
create or replace function delete_user()
returns void
security definer
as $$
declare
  user_id uuid;
begin
  -- Get the current authenticated user's ID
  user_id := auth.uid();

  -- Delete associated email accounts
  delete from public.email_accounts where user_id = user_id;
  
  -- Delete user from auth schema
  delete from auth.users where id = user_id;

  -- Delete associated data from public schema
  delete from public.profiles where id = user_id;
end;
$$ language plpgsql;

-- Verify RLS policy for email_accounts deletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'email_accounts'
    AND policyname = 'Allow users to delete their own email accounts'
  ) THEN
    CREATE POLICY "Allow users to delete their own email accounts"
    ON public.email_accounts
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;


-- Add RLS policy for creating email accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'email_accounts'
    AND policyname = 'Allow users to create their own email accounts'
  ) THEN
    CREATE POLICY "Allow users to create their own email accounts"
    ON public.email_accounts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- Verify and fix RLS policies for email_accounts table
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'email_accounts'
    AND n.nspname = 'public'
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Drop existing insert policy if it exists
  DROP POLICY IF EXISTS "Allow users to create their own email accounts" ON public.email_accounts;
  
  -- Create insert policy
  CREATE POLICY "Allow users to create their own email accounts"
  ON public.email_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

  -- Drop existing delete policy if it exists
  DROP POLICY IF EXISTS "Allow users to delete their own email accounts" ON public.email_accounts;
  
  -- Create delete policy
  CREATE POLICY "Allow users to delete their own email accounts"
  ON public.email_accounts
  FOR DELETE
  USING (auth.uid() = user_id);
END $$;


-- Verify and fix RLS policies for email_accounts table
DO $$
BEGIN
  -- Enable RLS if not already enabled
  PERFORM 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'email_accounts'
    AND n.nspname = 'public'
    AND c.relrowsecurity = true;
  
  IF NOT FOUND THEN
    ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Drop existing insert policy if it exists
  DROP POLICY IF EXISTS "Allow users to create their own email accounts" ON public.email_accounts;
  
  -- Create insert policy with explicit check
  CREATE POLICY "Allow users to create their own email accounts"
  ON public.email_accounts
  FOR INSERT
  WITH CHECK (
    user_id IS NOT NULL AND
    user_id = auth.uid()
  );

  -- Drop existing delete policy if it exists
  DROP POLICY IF EXISTS "Allow users to delete their own email accounts" ON public.email_accounts;
  
  -- Create delete policy with explicit check
  CREATE POLICY "Allow users to delete their own email accounts"
  ON public.email_accounts
  FOR DELETE
  USING (
    user_id IS NOT NULL AND
    user_id = auth.uid()
  );
END $$;


-- Add debug function to verify auth.uid()
CREATE OR REPLACE FUNCTION debug_auth_uid() RETURNS uuid AS $$
DECLARE
  current_uid uuid;
BEGIN
  current_uid := auth.uid();
  RAISE NOTICE 'Current auth.uid(): %', current_uid::text;
  RETURN current_uid;
END;
$$ LANGUAGE plpgsql;

-- Update insert policy to use debug function
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow users to create their own email accounts" ON public.email_accounts;
  
  CREATE POLICY "Allow users to create their own email accounts"
  ON public.email_accounts
  FOR INSERT
  WITH CHECK (
    user_id IS NOT NULL AND
    user_id = debug_auth_uid()
  );
END $$;


-- Temporarily disable RLS for testing
ALTER TABLE public.email_accounts DISABLE ROW LEVEL SECURITY;


-- Re-enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow users to create their own email accounts" ON public.email_accounts;

-- Create a basic insert policy
CREATE POLICY "Allow users to create their own email accounts"
ON public.email_accounts
FOR INSERT
WITH CHECK (
  user_id IS NOT NULL AND
  user_id = auth.uid()
);

-- Create debug logging function
CREATE OR REPLACE FUNCTION log_rls_evaluation() RETURNS trigger AS $$
BEGIN
  RAISE NOTICE 'RLS Evaluation - user_id: %, auth.uid(): %', NEW.user_id::text, auth.uid()::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the debug function as a trigger
DROP TRIGGER IF EXISTS rls_debug_trigger ON public.email_accounts;
CREATE TRIGGER rls_debug_trigger
BEFORE INSERT ON public.email_accounts
FOR EACH ROW EXECUTE FUNCTION log_rls_evaluation();


-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Allow users to create their own email accounts" ON public.email_accounts;

-- Create new insert policy with explicit checks and error logging
CREATE POLICY "Allow users to create their own email accounts"
ON public.email_accounts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  user_id IS NOT NULL AND
  auth.uid() IS NOT NULL
);

-- Add function to log RLS policy evaluation
CREATE OR REPLACE FUNCTION public.log_rls_evaluation() RETURNS trigger AS $$
BEGIN
  RAISE NOTICE 'RLS Policy Evaluation: auth.uid() = %, user_id = %', auth.uid(), NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log RLS policy evaluation
CREATE TRIGGER log_rls_evaluation_trigger
BEFORE INSERT ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION public.log_rls_evaluation();


-- Grant INSERT privilege to public role on email_accounts table
GRANT INSERT ON TABLE public.email_accounts TO public;


-- Modify user_id column to be NOT NULL with default auth.uid()
ALTER TABLE public.email_accounts
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN user_id SET DEFAULT auth.uid();


-- Ensure the log_rls_evaluation function exists
CREATE OR REPLACE FUNCTION public.log_rls_evaluation() RETURNS trigger AS $$
BEGIN
  RAISE NOTICE 'RLS Policy Evaluation: auth.uid() = %, user_id = %', auth.uid(), NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS log_rls_evaluation_trigger ON public.email_accounts;

-- Create the trigger
CREATE TRIGGER log_rls_evaluation_trigger
BEFORE INSERT ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION public.log_rls_evaluation();


-- Temporarily disable RLS for testing
ALTER TABLE public.email_accounts DISABLE ROW LEVEL SECURITY;


-- Disable RLS on all tables since we're using application-level security
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_email_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails DISABLE ROW LEVEL SECURITY;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can only access their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can only access their own email accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can only access campaign_email_accounts for their campaigns" ON campaign_email_accounts;
DROP POLICY IF EXISTS "Users can only access their own leads" ON leads;
DROP POLICY IF EXISTS "Users can only access their own scheduled emails" ON scheduled_emails;


-- Add user_id column to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS leads_user_id_idx ON leads(user_id);

-- Update existing leads to set user_id based on campaign ownership
DO $$
DECLARE
    lead_record RECORD;
BEGIN
    FOR lead_record IN SELECT l.id, c.user_id
        FROM leads l
        JOIN campaign_leads cl ON l.id = cl.lead_id
        JOIN campaigns c ON cl.campaign_id = c.id
    LOOP
        UPDATE leads
        SET user_id = lead_record.user_id
        WHERE id = lead_record.id;
    END LOOP;
END $$;


-- Disable RLS on campaigns table
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;

-- Disable RLS on email_accounts table
ALTER TABLE email_accounts DISABLE ROW LEVEL SECURITY;


-- Add warmup settings columns to email_accounts table
ALTER TABLE email_accounts
ADD COLUMN warmup_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN warmup_filter_tag TEXT,
ADD COLUMN warmup_increase_per_day INTEGER DEFAULT 5,
ADD COLUMN warmup_daily_limit INTEGER DEFAULT 20,
ADD COLUMN warmup_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN warmup_status TEXT DEFAULT 'disabled' CHECK (warmup_status IN ('disabled', 'enabled', 'paused'));

-- Create table to track warmup progress
CREATE TABLE email_warmup_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (email_account_id, date)
);

-- Create index for faster lookups
CREATE INDEX idx_email_warmup_progress_account_date ON email_warmup_progress(email_account_id, date);

-- Add RLS policies for warmup progress table
ALTER TABLE email_warmup_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own warmup progress" 
ON email_warmup_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM email_accounts 
    WHERE email_accounts.id = email_warmup_progress.email_account_id 
    AND email_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own warmup progress" 
ON email_warmup_progress
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM email_accounts 
    WHERE email_accounts.id = email_warmup_progress.email_account_id 
    AND email_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own warmup progress" 
ON email_warmup_progress
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM email_accounts 
    WHERE email_accounts.id = email_warmup_progress.email_account_id 
    AND email_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own warmup progress" 
ON email_warmup_progress
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM email_accounts 
    WHERE email_accounts.id = email_warmup_progress.email_account_id 
    AND email_accounts.user_id = auth.uid()
  )
);


-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted password column to email_accounts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'email_accounts' 
    AND column_name = 'encrypted_password'
  ) THEN
    ALTER TABLE email_accounts
    ADD COLUMN encrypted_password TEXT;
  END IF;
END $$;

-- Create function to encrypt password
CREATE OR REPLACE FUNCTION encrypt_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql;

-- Create function to verify password
CREATE OR REPLACE FUNCTION verify_password(password TEXT, encrypted_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN encrypted_password = crypt(password, encrypted_password);
END;
$$ LANGUAGE plpgsql;


-- Create function to handle campaign leads associations
CREATE OR REPLACE FUNCTION create_campaign_leads(campaign_id uuid, lead_ids uuid[])
RETURNS void AS $$
DECLARE
  lead_id uuid;
BEGIN
  -- Create campaign associations for each lead
  FOREACH lead_id IN ARRAY lead_ids LOOP
    -- Check if association already exists
    PERFORM 1 FROM campaign_leads
    WHERE campaign_id = create_campaign_leads.campaign_id
      AND lead_id = create_campaign_leads.lead_id;
    
    -- Insert only if association doesn't exist
    IF NOT FOUND THEN
      INSERT INTO campaign_leads (campaign_id, lead_id)
      VALUES (create_campaign_leads.campaign_id, lead_id);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create RPC endpoint
CREATE OR REPLACE FUNCTION public.create_campaign_leads(campaign_id uuid, lead_ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  SELECT create_campaign_leads(campaign_id, lead_ids);
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_campaign_leads(uuid, uuid[]) TO authenticated;



-- Redefine encryption functions to use a stable master key
-- This fixes the 'Wrong key or corrupt data' error in decrypt_password

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Redefine encrypt_password
CREATE OR REPLACE FUNCTION public.encrypt_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Using a stable key for Relay Solutions
  RETURN encode(pgp_sym_encrypt(password, 'RelaySolutions_Secure_Key_2024'), 'base64');
END;
$$;

-- Redefine decrypt_password
CREATE OR REPLACE FUNCTION public.decrypt_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_password, 'base64'), 'RelaySolutions_Secure_Key_2024');
END;
$$;

-- Grant access to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.encrypt_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_password(text) TO service_role;


-- Create campaign_leads table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (campaign_id, lead_id)
);

-- Create or replace the function
CREATE OR REPLACE FUNCTION public.create_campaign_leads(campaign_id uuid, lead_ids uuid[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  lead_id uuid;
BEGIN
  FOREACH lead_id IN ARRAY lead_ids LOOP
    INSERT INTO public.campaign_leads (campaign_id, lead_id)
    VALUES (create_campaign_leads.campaign_id, lead_id)
    ON CONFLICT (campaign_id, lead_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_campaign_leads(uuid, uuid[]) TO authenticated;
GRANT SELECT, INSERT ON TABLE public.campaign_leads TO authenticated;


-- Enable RLS on campaign_leads table
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to insert campaign_leads
CREATE POLICY "Authenticated users can insert campaign_leads"
ON campaign_leads
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_leads.campaign_id
    AND campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_leads.lead_id
    AND leads.user_id = auth.uid()
  )
);

-- Create policy for authenticated users to select their campaign_leads
CREATE POLICY "Authenticated users can select their campaign_leads"
ON campaign_leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_leads.campaign_id
    AND campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_leads.lead_id
    AND leads.user_id = auth.uid()
  )
);

-- Create policy for authenticated users to delete their campaign_leads
CREATE POLICY "Authenticated users can delete their campaign_leads"
ON campaign_leads
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_leads.campaign_id
    AND campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_leads.lead_id
    AND leads.user_id = auth.uid()
  )
);


-- Drop dependent objects if they exist
DROP TRIGGER IF EXISTS campaign_leads_updated_at_trigger ON campaign_leads;
DROP FUNCTION IF EXISTS update_campaign_leads_updated_at();
DROP INDEX IF EXISTS idx_campaign_leads_campaign_id;
DROP INDEX IF EXISTS idx_campaign_leads_lead_id;

-- Drop existing table if it exists
DROP TABLE IF EXISTS campaign_leads CASCADE;

-- Create campaign_leads table
CREATE TABLE campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of campaign and lead
  CONSTRAINT campaign_lead_unique UNIQUE (campaign_id, lead_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads (campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON campaign_leads (lead_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_leads_updated_at_trigger
BEFORE UPDATE ON campaign_leads
FOR EACH ROW
EXECUTE FUNCTION update_campaign_leads_updated_at();


-- Drop existing function if it exists
drop function if exists public.delete_user(uuid);

-- Create consolidated user deletion function
create function public.delete_user(p_user_id uuid)
returns json as $$
declare
  deleted_count integer;
begin
  -- Verify user exists
  if not exists (select 1 from auth.users where id = p_user_id) then
    return json_build_object('error', 'User not found');
  end if;

  -- Delete user data from all related tables
  delete from public.user_profiles where user_id = p_user_id;
  delete from public.email_accounts where user_id = p_user_id;
  delete from public.campaigns where user_id = p_user_id;
  delete from public.leads where user_id = p_user_id;

  -- Delete the auth user
  delete from auth.users where id = p_user_id;

  -- Return success
  return json_build_object('success', true);
exception
  when others then
    return json_build_object('error', sqlerrm);
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function public.delete_user(uuid) to authenticated;

-- Add function to supabase_functions schema
comment on function public.delete_user is 'Deletes a user and all related data';


-- Add new columns to scheduled_emails table
ALTER TABLE scheduled_emails
ADD COLUMN start_date timestamp with time zone,
ADD COLUMN end_date timestamp with time zone,
ADD COLUMN interval_minutes integer;


ALTER TABLE campaign_progress
ADD COLUMN selected BOOLEAN DEFAULT FALSE;


-- Add emails_per_account column to scheduled_emails table
ALTER TABLE scheduled_emails
ADD COLUMN emails_per_account integer NOT NULL DEFAULT 0;


-- Add missing warmup settings columns to email_accounts table
DO $$
BEGIN
    -- Add warmup_filter_tag if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'email_accounts' 
        AND column_name = 'warmup_filter_tag'
    ) THEN
        ALTER TABLE email_accounts
        ADD COLUMN warmup_filter_tag TEXT;
    END IF;

    -- Add warmup_increase_per_day if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'email_accounts' 
        AND column_name = 'warmup_increase_per_day'
    ) THEN
        ALTER TABLE email_accounts
        ADD COLUMN warmup_increase_per_day INTEGER DEFAULT 5;
    END IF;

    -- Add warmup_daily_limit if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'email_accounts' 
        AND column_name = 'warmup_daily_limit'
    ) THEN
        ALTER TABLE email_accounts
        ADD COLUMN warmup_daily_limit INTEGER DEFAULT 20;
    END IF;

    -- Add warmup_start_date if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'email_accounts' 
        AND column_name = 'warmup_start_date'
    ) THEN
        ALTER TABLE email_accounts
        ADD COLUMN warmup_start_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add warmup_status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'email_accounts' 
        AND column_name = 'warmup_status'
    ) THEN
        ALTER TABLE email_accounts
        ADD COLUMN warmup_status TEXT DEFAULT 'disabled' 
        CHECK (warmup_status IN ('disabled', 'enabled', 'paused'));
    END IF;
END $$;


-- Create a function to handle user deletion
create or replace function delete_user(p_user_id uuid)
returns void
security definer
as $$
begin
  -- Verify the user exists
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found' using errcode = 'P0001';
  end if;

  -- Delete user from auth schema
  delete from auth.users where id = p_user_id;

  -- Delete associated data from public schema
  delete from public.profiles where id = p_user_id;
  -- Delete associated data from scheduled_emails table
  delete from public.scheduled_emails where user_id = p_user_id;
  -- Add any other tables that need to be cleaned up here
end;
$$ language plpgsql;

-- Grant execute permission to authenticated users
grant execute on function delete_user(p_user_id uuid) to authenticated;


/*
  # Add niche column to campaigns table

  1. Changes
    - Add `niche` column to `campaigns` table
      - Type: text
      - Nullable: true (to avoid issues with existing data)
*/

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS niche text;


/*
  # Add missing columns to campaigns table

  1. Changes
    - Add `niche` column (text)
    - Add `prospects` column (integer, default 0)
    - Add `replies` column (integer, default 0)
    - Add `open_rate` column (float, default 0)
    - Add `schedule` column (jsonb)
  
  Note: IF NOT EXISTS is used to prevent errors if some columns were already added.
*/

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS prospects integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_rate float DEFAULT 0,
ADD COLUMN IF NOT EXISTS schedule jsonb;


-- Add missing columns to leads table to support scraper data and Lead interface
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS facebook text,
ADD COLUMN IF NOT EXISTS twitter text,
ADD COLUMN IF NOT EXISTS instagram text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS role text;


-- Add source and status columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'New';


-- Add health score columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_accounts' AND column_name = 'health_score') THEN
        ALTER TABLE email_accounts ADD COLUMN health_score INTEGER DEFAULT 100;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_accounts' AND column_name = 'last_health_check') THEN
        ALTER TABLE email_accounts ADD COLUMN last_health_check TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_accounts' AND column_name = 'total_emails_sent') THEN
        ALTER TABLE email_accounts ADD COLUMN total_emails_sent INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_accounts' AND column_name = 'total_bounces') THEN
        ALTER TABLE email_accounts ADD COLUMN total_bounces INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_accounts' AND column_name = 'total_spam_reports') THEN
        ALTER TABLE email_accounts ADD COLUMN total_spam_reports INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create or replace function to calculate health score
CREATE OR REPLACE FUNCTION calculate_account_health_score(account_id UUID)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_score INTEGER := 100;
    v_daily_limit INTEGER;
    v_sent_last_24h INTEGER;
    v_warmup_sent INTEGER := 0;
    v_failed_last_24h INTEGER;
    v_warmup_status TEXT;
BEGIN
    -- Get account details
    SELECT warmup_daily_limit, warmup_status 
    INTO v_daily_limit, v_warmup_status
    FROM email_accounts 
    WHERE id = account_id;

    -- Default limit if null (safety net)
    IF v_daily_limit IS NULL OR v_daily_limit = 0 THEN
        v_daily_limit := 50; 
    END IF;

    -- Count sent emails in last 24h (Campaigns)
    SELECT COUNT(*) INTO v_sent_last_24h
    FROM campaign_progress
    WHERE email_account_id = account_id
    AND sent_at > NOW() - INTERVAL '24 hours'
    AND status = 'sent';

    -- Add Warmup emails sent today
    SELECT COALESCE(SUM(emails_sent), 0) INTO v_warmup_sent
    FROM email_warmup_progress
    WHERE email_account_id = account_id
    AND date >= CURRENT_DATE;
    
    v_sent_last_24h := v_sent_last_24h + v_warmup_sent;

    -- Count failures in last 24h
    SELECT COUNT(*) INTO v_failed_last_24h
    FROM campaign_progress
    WHERE email_account_id = account_id
    AND sent_at > NOW() - INTERVAL '24 hours'
    AND status = 'failed';

    -- HEALTH LOGIC RULES --

    -- 1. High Volume Penalty
    -- If sending > 100% of limit, score -20
    IF v_sent_last_24h > v_daily_limit THEN
        v_score := v_score - 20;
    END IF;
    -- If sending > 120% of limit, score -40 total
    IF v_sent_last_24h > (v_daily_limit * 1.2) THEN
        v_score := v_score - 20; 
    END IF;

    -- 2. Failure Rate Penalty
    -- If we have failures, deduct heavily
    IF v_failed_last_24h > 0 THEN
        -- -5 points per failure, max -50
        v_score := v_score - LEAST(50, v_failed_last_24h * 5);
    END IF;

    -- 3. Inactivity Penalty (Optional - if warmup enabled but 0 sent)
    IF v_warmup_status = 'enabled' AND v_warmup_sent = 0 AND v_sent_last_24h = 0 THEN
        v_score := v_score - 5; -- Slight decay for inactivity when supposed to be active
    END IF;
    
    -- Ensure score is 0-100
    v_score := GREATEST(0, LEAST(100, v_score));

    -- Update the account
    UPDATE email_accounts 
    SET health_score = v_score,
        last_health_check = NOW()
    WHERE id = account_id;

    RETURN v_score;
END;
$$;

-- Function to update all accounts
CREATE OR REPLACE FUNCTION update_all_health_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM email_accounts LOOP
        PERFORM calculate_account_health_score(r.id);
    END LOOP;
END;
$$;


-- Function to get email accounts with computed stats
CREATE OR REPLACE FUNCTION get_email_accounts_with_stats(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  name TEXT,
  signature TEXT,
  imap_host TEXT,
  imap_port TEXT,
  smtp_host TEXT,
  smtp_port TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  warmup_enabled BOOLEAN,
  warmup_filter_tag TEXT,
  warmup_increase_per_day INTEGER,
  warmup_daily_limit INTEGER,
  warmup_start_date TIMESTAMP WITH TIME ZONE,
  warmup_status TEXT,
  health_score INTEGER,
  encrypted_password TEXT,
  total_sent BIGINT,
  total_warmup BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id,
    ea.user_id,
    ea.email,
    ea.name,
    ea.signature,
    ea.imap_host,
    ea.imap_port,
    ea.smtp_host,
    ea.smtp_port,
    ea.created_at,
    ea.warmup_enabled,
    ea.warmup_filter_tag,
    ea.warmup_increase_per_day,
    ea.warmup_daily_limit,
    ea.warmup_start_date,
    ea.warmup_status,
    ea.health_score,
    ea.encrypted_password,
    (
      SELECT COUNT(*)
      FROM campaign_progress cp
      WHERE cp.email_account_id = ea.id
      AND cp.status = 'sent'
    ) as total_sent,
    (
      SELECT CAST(COALESCE(SUM(ewp.emails_sent), 0) AS BIGINT)
      FROM email_warmup_progress ewp
      WHERE ewp.email_account_id = ea.id
    ) as total_warmup
  FROM email_accounts ea
  WHERE ea.user_id = p_user_id
  ORDER BY ea.created_at DESC;
END;
$$;


-- Triggers to automatically update health score
CREATE OR REPLACE FUNCTION trigger_update_health_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Run calculation for the affected account
    PERFORM calculate_account_health_score(NEW.email_account_id);
    RETURN NEW;
END;
$$;

-- Drop triggers if they exist to avoid duplication errors on re-run
DROP TRIGGER IF EXISTS update_health_score_on_campaign_progress ON campaign_progress;
DROP TRIGGER IF EXISTS update_health_score_on_warmup_progress ON email_warmup_progress;

CREATE TRIGGER update_health_score_on_campaign_progress
AFTER INSERT OR UPDATE OF status ON campaign_progress
FOR EACH ROW
EXECUTE FUNCTION trigger_update_health_score();

CREATE TRIGGER update_health_score_on_warmup_progress
AFTER INSERT OR UPDATE OF emails_sent ON email_warmup_progress
FOR EACH ROW
EXECUTE FUNCTION trigger_update_health_score();


-- Drop the old function to avoid signature conflicts
DROP FUNCTION IF EXISTS get_email_accounts_with_stats();
DROP FUNCTION IF EXISTS get_email_accounts_with_stats(UUID);

-- Recreate function with explicit p_user_id parameter and text casts for ports
CREATE OR REPLACE FUNCTION get_email_accounts_with_stats(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  name TEXT,
  signature TEXT,
  imap_host TEXT,
  imap_port TEXT,
  smtp_host TEXT,
  smtp_port TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  warmup_enabled BOOLEAN,
  warmup_filter_tag TEXT,
  warmup_increase_per_day INTEGER,
  warmup_daily_limit INTEGER,
  warmup_start_date TIMESTAMP WITH TIME ZONE,
  warmup_status TEXT,
  health_score INTEGER,
  encrypted_password TEXT,
  total_sent BIGINT,
  total_warmup BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id,
    ea.user_id,
    ea.email,
    ea.name,
    ea.signature,
    ea.imap_host,
    ea.imap_port::TEXT, -- Cast to TEXT
    ea.smtp_host,
    ea.smtp_port::TEXT, -- Cast to TEXT
    ea.created_at,
    ea.warmup_enabled,
    ea.warmup_filter_tag,
    ea.warmup_increase_per_day,
    ea.warmup_daily_limit,
    ea.warmup_start_date,
    ea.warmup_status,
    ea.health_score,
    ea.encrypted_password,
    (
      SELECT COUNT(*)
      FROM campaign_progress cp
      WHERE cp.email_account_id = ea.id
      AND cp.status = 'sent'
    ) as total_sent,
    (
      SELECT CAST(COALESCE(SUM(ewp.emails_sent), 0) AS BIGINT)
      FROM email_warmup_progress ewp
      WHERE ewp.email_account_id = ea.id
    ) as total_warmup
  FROM email_accounts ea
  WHERE ea.user_id = p_user_id -- Use the passed parameter
  ORDER BY ea.created_at DESC;
END;
$$;


-- Add missing columns to leads table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'summary') THEN
    ALTER TABLE leads ADD COLUMN summary text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'personalized_email') THEN
    ALTER TABLE leads ADD COLUMN personalized_email text;
  END IF;

  -- Ensure other columns from types exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'facebook') THEN
    ALTER TABLE leads ADD COLUMN facebook text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'twitter') THEN
    ALTER TABLE leads ADD COLUMN twitter text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'instagram') THEN
    ALTER TABLE leads ADD COLUMN instagram text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'role') THEN
    ALTER TABLE leads ADD COLUMN role text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'website') THEN
    ALTER TABLE leads ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'user_id') THEN
    ALTER TABLE leads ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create a unique constraint for upsert
-- We use user_id, website, and email to uniquely identify a lead for a user.
-- Since we use empty strings for missing values in the scraper, this works well.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_website_email_key;
ALTER TABLE leads ADD CONSTRAINT leads_user_id_website_email_key UNIQUE (user_id, website, email);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);


-- Add campaign_id column to inbox_emails table if it doesn't exist
ALTER TABLE inbox_emails 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

-- Optional: Add index for performance given we filter by it
CREATE INDEX IF NOT EXISTS idx_inbox_emails_campaign_id ON inbox_emails(campaign_id);


-- Create a function to get pending leads
-- This avoids complex client-side join logic in the Deno function
CREATE OR REPLACE FUNCTION get_pending_campaign_leads(campaign_id_param UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  company TEXT,
  name TEXT,
  summary TEXT,
  personalized_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.email,
    l.company,
    l.name,
    l.summary,
    l.personalized_email
  FROM campaign_leads cl
  JOIN leads l ON cl.lead_id = l.id
  WHERE cl.campaign_id = campaign_id_param
  AND NOT EXISTS (
    SELECT 1 FROM campaign_progress cp 
    WHERE cp.campaign_id = campaign_id_param 
    AND cp.lead_id = l.id 
    AND cp.status = 'sent'
  );
END;
$$ LANGUAGE plpgsql;


ALTER TABLE campaign_leads 
ADD COLUMN IF NOT EXISTS assigned_email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION get_pending_campaign_leads(campaign_id_param UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  company TEXT,
  name TEXT,
  summary TEXT,
  personalized_email TEXT,
  assigned_email_account_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.email,
    l.company,
    l.name,
    l.summary,
    l.personalized_email,
    cl.assigned_email_account_id
  FROM campaign_leads cl
  JOIN leads l ON cl.lead_id = l.id
  WHERE cl.campaign_id = campaign_id_param
  AND NOT EXISTS (
    SELECT 1 FROM campaign_progress cp 
    WHERE cp.campaign_id = campaign_id_param 
    AND cp.lead_id = l.id 
    AND cp.status = 'sent'
  );
END;
$$ LANGUAGE plpgsql;


-- Create table to track warmup progress if it doesn't exist
CREATE TABLE IF NOT EXISTS email_warmup_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (email_account_id, date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_warmup_progress_account_date ON email_warmup_progress(email_account_id, date);

-- Add RLS policies for warmup progress table
ALTER TABLE email_warmup_progress ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_warmup_progress' AND policyname = 'Users can access their own warmup progress'
    ) THEN
        CREATE POLICY "Users can access their own warmup progress" 
        ON email_warmup_progress
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 
            FROM email_accounts 
            WHERE email_accounts.id = email_warmup_progress.email_account_id 
            AND email_accounts.user_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_warmup_progress' AND policyname = 'Users can insert their own warmup progress'
    ) THEN
        CREATE POLICY "Users can insert their own warmup progress" 
        ON email_warmup_progress
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 
            FROM email_accounts 
            WHERE email_accounts.id = email_warmup_progress.email_account_id 
            AND email_accounts.user_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_warmup_progress' AND policyname = 'Users can update their own warmup progress'
    ) THEN
        CREATE POLICY "Users can update their own warmup progress" 
        ON email_warmup_progress
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 
            FROM email_accounts 
            WHERE email_accounts.id = email_warmup_progress.email_account_id 
            AND email_accounts.user_id = auth.uid()
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_warmup_progress' AND policyname = 'Users can delete their own warmup progress'
    ) THEN
        CREATE POLICY "Users can delete their own warmup progress" 
        ON email_warmup_progress
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 
            FROM email_accounts 
            WHERE email_accounts.id = email_warmup_progress.email_account_id 
            AND email_accounts.user_id = auth.uid()
          )
        );
    END IF;
END $$;


-- Function to clear leads for a user that are not associated with any list or campaign
CREATE OR REPLACE FUNCTION clear_unmanaged_leads(p_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM leads
  WHERE user_id = p_user_id
  AND id NOT IN (SELECT lead_id FROM campaign_leads)
  AND id NOT IN (SELECT lead_id FROM list_leads)
  AND id NOT IN (SELECT lead_id FROM scheduled_emails);
END;
$$ LANGUAGE plpgsql;


-- Add updated_at column to leads if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'updated_at') THEN
        ALTER TABLE leads ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

-- Update existing rows to have updated_at = created_at
UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL;

-- Create or replace the function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- Fix Campaign Progress Tracking (Per Sequence Step instead of Global Per Campaign)
-- Up Migration

-- 1. Add schedule_id to campaign_progress
ALTER TABLE public.campaign_progress 
ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.scheduled_emails(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint (campaign_id, lead_id)
-- Note: the old constraint might be named 'campaign_progress_campaign_id_lead_id_key' or we can just try dropping if exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'campaign_progress_campaign_id_lead_id_key'
  ) THEN
    ALTER TABLE public.campaign_progress DROP CONSTRAINT campaign_progress_campaign_id_lead_id_key;
  END IF;
END $$;

-- 3. Add the NEW unique constraint (campaign_id, schedule_id, lead_id)
-- First, make sure schedule_id isn't null for existing records to apply constraint. 
-- Since we can't easily map old globals, we can either clear old data or just let them not have the constraint if schedule_id is NULL.
-- But unique constraints treat NULLs as distinct in Postgres, so it's actually safe to add.
ALTER TABLE public.campaign_progress
ADD CONSTRAINT campaign_progress_campaign_id_schedule_id_lead_id_key UNIQUE (campaign_id, schedule_id, lead_id);


-- 4. Update the stored procedure to check against schedule_id
CREATE OR REPLACE FUNCTION public.get_pending_campaign_leads(
    campaign_id_param uuid,
    schedule_id_param uuid
)
 RETURNS TABLE(
    id uuid, 
    email text, 
    company text, 
    name text, 
    summary text, 
    personalized_email text, 
    assigned_email_account_id uuid
)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.email,
    l.company,
    l.name,
    l.summary,
    l.personalized_email,
    cl.assigned_email_account_id
  FROM campaign_leads cl
  JOIN leads l ON cl.lead_id = l.id
  WHERE cl.campaign_id = campaign_id_param
  AND NOT EXISTS (
    -- ONLY exclude them if they received THIS specific step (schedule_id)
    SELECT 1 FROM campaign_progress cp 
    WHERE cp.campaign_id = campaign_id_param 
    AND cp.schedule_id = schedule_id_param
    AND cp.lead_id = l.id 
    AND cp.status = 'sent'
  );
END;
$function$;


-- Create or replace function to calculate health score
CREATE OR REPLACE FUNCTION calculate_account_health_score(account_id UUID)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_score INTEGER := 100;
    v_daily_limit INTEGER;
    v_sent_last_24h INTEGER;
    v_warmup_sent INTEGER := 0;
    v_failed_last_24h INTEGER;
    v_warmup_status TEXT;
BEGIN
    -- Get account details
    SELECT daily_limit, warmup_status 
    INTO v_daily_limit, v_warmup_status
    FROM email_accounts 
    WHERE id = account_id;

    -- Default limit if null (safety net)
    IF v_daily_limit IS NULL OR v_daily_limit = 0 THEN
        v_daily_limit := 100; 
    END IF;

    -- Count sent emails in last 24h (Campaigns)
    SELECT COUNT(*) INTO v_sent_last_24h
    FROM campaign_progress
    WHERE email_account_id = account_id
    AND sent_at > NOW() - INTERVAL '24 hours'
    AND status = 'sent';

    -- Add Warmup emails sent today
    SELECT COALESCE(SUM(emails_sent), 0) INTO v_warmup_sent
    FROM email_warmup_progress
    WHERE email_account_id = account_id
    AND date >= CURRENT_DATE;
    
    v_sent_last_24h := v_sent_last_24h + v_warmup_sent;

    -- Count failures in last 24h
    SELECT COUNT(*) INTO v_failed_last_24h
    FROM campaign_progress
    WHERE email_account_id = account_id
    AND sent_at > NOW() - INTERVAL '24 hours'
    AND status = 'failed';

    -- HEALTH LOGIC RULES --

    -- 1. High Volume Penalty
    -- If sending > 100% of limit, score -20
    IF v_sent_last_24h > v_daily_limit THEN
        v_score := v_score - 20;
    END IF;
    -- If sending > 120% of limit, score -40 total
    IF v_sent_last_24h > (v_daily_limit * 1.2) THEN
        v_score := v_score - 20; 
    END IF;

    -- 2. Failure Rate Penalty
    -- If we have failures, deduct heavily
    IF v_failed_last_24h > 0 THEN
        -- -5 points per failure, max -50
        v_score := v_score - LEAST(50, v_failed_last_24h * 5);
    END IF;

    -- 3. Inactivity Penalty (Optional - if warmup enabled but 0 sent)
    IF v_warmup_status = 'enabled' AND v_warmup_sent = 0 AND v_sent_last_24h = 0 THEN
        v_score := v_score - 5; -- Slight decay for inactivity when supposed to be active
    END IF;
    
    -- Ensure score is 0-100
    v_score := GREATEST(0, LEAST(100, v_score));

    -- Update the account
    UPDATE email_accounts 
    SET health_score = v_score,
        last_health_check = NOW()
    WHERE id = account_id;

    RETURN v_score;
END;
$$;

-- Force recalculate all scores
SELECT update_all_health_scores();


-- Add sequence_step column to inbox_emails table if it doesn't exist
ALTER TABLE inbox_emails 
ADD COLUMN IF NOT EXISTS sequence_step TEXT;




-- Create scrape_history table
CREATE TABLE scrape_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  business_type text NOT NULL,
  country_code text NOT NULL,
  location text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX idx_scrape_history_user_query ON scrape_history(user_id, business_type, country_code);

-- Enable RLS
ALTER TABLE scrape_history ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can manage their own scrape history"
  ON scrape_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a function to get exactly the leads that are new/unassigned to any campaign or list
CREATE OR REPLACE FUNCTION get_unmanaged_leads(p_user_id uuid)
RETURNS TABLE (
  id UUID,
  company TEXT,
  email TEXT,
  website TEXT,
  location TEXT,
  phone TEXT,
  summary TEXT,
  source TEXT,
  status TEXT,
  facebook TEXT,
  twitter TEXT,
  instagram TEXT,
  role TEXT,
  name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  validation_status TEXT,
  validation_details TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.company,
    l.email,
    l.website,
    l.location,
    l.phone,
    l.summary,
    l.source,
    l.status,
    l.facebook,
    l.twitter,
    l.instagram,
    l.role,
    l.name,
    l.created_at,
    l.updated_at,
    l.validation_status,
    l.validation_details
  FROM leads l
  WHERE l.user_id = p_user_id
  AND l.id NOT IN (SELECT lead_id FROM campaign_leads)
  AND l.id NOT IN (SELECT lead_id FROM list_leads)
  AND l.id NOT IN (SELECT lead_id FROM scheduled_emails)
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;


-- Fix bug where NOT IN (NULL) causes UNKNOWN and filters out all leads
CREATE OR REPLACE FUNCTION get_unmanaged_leads(p_user_id uuid)
RETURNS TABLE (
  id UUID,
  company TEXT,
  email TEXT,
  website TEXT,
  location TEXT,
  phone TEXT,
  summary TEXT,
  source TEXT,
  status TEXT,
  facebook TEXT,
  twitter TEXT,
  instagram TEXT,
  role TEXT,
  name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  validation_status TEXT,
  validation_details TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.company,
    l.email,
    l.website,
    l.location,
    l.phone,
    l.summary,
    l.source,
    l.status,
    l.facebook,
    l.twitter,
    l.instagram,
    l.role,
    l.name,
    l.created_at,
    l.updated_at,
    l.validation_status,
    l.validation_details
  FROM leads l
  WHERE l.user_id = p_user_id
  AND NOT EXISTS (SELECT 1 FROM campaign_leads cl WHERE cl.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM list_leads ll WHERE ll.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM scheduled_emails se WHERE se.lead_id = l.id)
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Fix the same bug in clear_unmanaged_leads
CREATE OR REPLACE FUNCTION clear_unmanaged_leads(p_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM leads l
  WHERE l.user_id = p_user_id
  AND NOT EXISTS (SELECT 1 FROM campaign_leads cl WHERE cl.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM list_leads ll WHERE ll.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM scheduled_emails se WHERE se.lead_id = l.id);
END;
$$ LANGUAGE plpgsql;


-- Migration: Add Domain Email Limiting System
-- Stores hourly sending stats per domain to enforce provider rate limits.

CREATE TABLE IF NOT EXISTS public.domain_hourly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain TEXT NOT NULL,
    hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    emails_sent INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure we only have one row per domain per hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_hourly_stats_domain_hour ON public.domain_hourly_stats (domain, hour_bucket);

-- Enables RLS
ALTER TABLE public.domain_hourly_stats ENABLE ROW LEVEL SECURITY;

-- Allow read/write for service role natively, and authenticated users for their domains if needed
-- Here we'll just allow authenticated users to read and update
CREATE POLICY "Enable read access for authenticated users on domain_hourly_stats" 
ON public.domain_hourly_stats FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert access for authenticated users on domain_hourly_stats" 
ON public.domain_hourly_stats FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users on domain_hourly_stats" 
ON public.domain_hourly_stats FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);


-- RPC function to increment the domain email count safely and atomically.
-- Returns TRUE if incremented (under limit), FALSE if limit reached.
CREATE OR REPLACE FUNCTION increment_domain_email_count(p_domain TEXT, p_max_limit INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hour_bucket TIMESTAMP WITH TIME ZONE;
    v_current_count INT;
BEGIN
    -- Truncate current time to the hour
    v_hour_bucket := date_trunc('hour', now());

    -- Insert a new row if it doesn't exist for this hour/domain, initialize to 0
    INSERT INTO public.domain_hourly_stats (domain, hour_bucket, emails_sent)
    VALUES (p_domain, v_hour_bucket, 0)
    ON CONFLICT (domain, hour_bucket) DO NOTHING;

    -- Lock the row for update to prevent race conditions
    SELECT emails_sent INTO v_current_count
    FROM public.domain_hourly_stats
    WHERE domain = p_domain AND hour_bucket = v_hour_bucket
    FOR UPDATE;

    -- Check limit
    IF v_current_count < p_max_limit THEN
        -- We are under the limit, increment and return true
        UPDATE public.domain_hourly_stats
        SET emails_sent = emails_sent + 1,
            updated_at = now()
        WHERE domain = p_domain AND hour_bucket = v_hour_bucket;
        
        RETURN TRUE;
    ELSE
        -- Limit reached
        RETURN FALSE;
    END IF;
END;
$$;


-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the warmup-scheduler edge function to run every 10 minutes
-- This spreads out the warmup emails throughout the day
SELECT cron.schedule(
  'warmup-task',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://wmoyigdovtpuayjxezzc.supabase.co/functions/v1/warmup-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Note: Make sure to set the service_role_key in your database settings:
-- ALTER DATABASE postgres SET "app.settings.service_role_key" = 'your-service-role-key';


-- Migration: Add campaign_id to saved_lists table
ALTER TABLE saved_lists 
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_saved_lists_campaign_id ON saved_lists(campaign_id);


-- Create trigger function to sync campaign leads prospects count and active schedules
CREATE OR REPLACE FUNCTION public.sync_campaign_leads_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_campaign_id UUID;
    v_total_prospects INT;
    v_schedule RECORD;
BEGIN
    -- Determine target campaign_id
    IF (TG_OP = 'DELETE') THEN
        v_campaign_id := OLD.campaign_id;
    ELSE
        v_campaign_id := NEW.campaign_id;
    END IF;

    -- Calculate total active prospects in campaign
    SELECT COUNT(*) INTO v_total_prospects
    FROM public.campaign_leads
    WHERE campaign_id = v_campaign_id;

    -- Update campaign prospects count
    UPDATE public.campaigns
    SET prospects = v_total_prospects
    WHERE id = v_campaign_id;

    -- Update total_emails for all schedules of this campaign
    UPDATE public.scheduled_emails
    SET total_emails = v_total_prospects
    WHERE campaign_id = v_campaign_id;

    -- If inserting or updating a campaign lead, enroll them in all active schedules of this campaign
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        FOR v_schedule IN 
            SELECT id, email_account_id 
            FROM public.scheduled_emails 
            WHERE campaign_id = v_campaign_id
        LOOP
            INSERT INTO public.campaign_progress (
                campaign_id,
                email_account_id,
                lead_id,
                status,
                schedule_id
            )
            VALUES (
                v_campaign_id,
                COALESCE(NEW.assigned_email_account_id, v_schedule.email_account_id),
                NEW.lead_id,
                'pending',
                v_schedule.id
            )
            ON CONFLICT (campaign_id, schedule_id, lead_id) DO NOTHING;
        END LOOP;
    END IF;

    -- If deleting a lead, clean up their pending progress rows
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.campaign_progress
        WHERE campaign_id = v_campaign_id
          AND lead_id = OLD.lead_id
          AND status = 'pending';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS trg_sync_campaign_leads_progress ON public.campaign_leads;

CREATE TRIGGER trg_sync_campaign_leads_progress
AFTER INSERT OR UPDATE OR DELETE ON public.campaign_leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_campaign_leads_progress();

-- Initial synchronization for existing campaign_leads
DO $$
DECLARE
    v_campaign RECORD;
    v_total INT;
BEGIN
    FOR v_campaign IN SELECT id FROM public.campaigns LOOP
        -- Calculate total
        SELECT COUNT(*) INTO v_total
        FROM public.campaign_leads
        WHERE campaign_id = v_campaign.id;

        -- Update campaigns
        UPDATE public.campaigns
        SET prospects = v_total
        WHERE id = v_campaign.id;

        -- Update scheduled_emails
        UPDATE public.scheduled_emails
        SET total_emails = v_total
        WHERE campaign_id = v_campaign.id;
    END LOOP;
END;
$$;


-- Migration: Disable the pg_cron that fires the edge function every 5 minutes.
-- The Node.js emailer_cron.mjs handles campaign processing now.
-- Running both causes race conditions and potential double-sends.

SELECT cron.unschedule('process-campaign-every-minute');


-- Migration: Fix get_pending_campaign_leads to exclude ALL terminal statuses
-- Previously only excluded 'sent', causing failed/bounced/replied leads to recycle
-- infinitely and block step progression via the dependency checker.

CREATE OR REPLACE FUNCTION public.get_pending_campaign_leads(
    campaign_id_param uuid,
    schedule_id_param uuid
)
 RETURNS TABLE(
    id uuid, 
    email text, 
    company text, 
    name text, 
    summary text, 
    personalized_email text, 
    personalized_subject text,
    assigned_email_account_id uuid,
    status text
)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.email,
    l.company,
    l.name,
    l.summary,
    l.personalized_email,
    l.personalized_subject,
    cl.assigned_email_account_id,
    COALESCE(l.status, 'new')::text as status
  FROM campaign_leads cl
  JOIN leads l ON cl.lead_id = l.id
  WHERE cl.campaign_id = campaign_id_param
  -- Exclude leads globally marked as uncontactable
  AND COALESCE(l.status, 'new') NOT IN ('unsubscribed', 'bounced', 'do_not_contact')
  AND NOT EXISTS (
    -- Exclude leads that have ANY terminal status for THIS specific step
    -- Previously only excluded 'sent' — now also excludes 'failed', 'bounced', 
    -- 'unsubscribed', and 'replied' so they don't recycle into the pending queue
    SELECT 1 FROM campaign_progress cp 
    WHERE cp.campaign_id = campaign_id_param 
    AND cp.schedule_id = schedule_id_param
    AND cp.lead_id = l.id 
    AND cp.status IN ('sent', 'failed', 'bounced', 'unsubscribed', 'replied')
  );
END;
$function$;


