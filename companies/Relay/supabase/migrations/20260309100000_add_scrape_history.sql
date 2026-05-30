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
