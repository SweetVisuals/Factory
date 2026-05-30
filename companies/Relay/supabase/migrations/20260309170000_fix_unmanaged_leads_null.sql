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
