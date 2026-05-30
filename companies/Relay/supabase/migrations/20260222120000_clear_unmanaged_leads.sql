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
