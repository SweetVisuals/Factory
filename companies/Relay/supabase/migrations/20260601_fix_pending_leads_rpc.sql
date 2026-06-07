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
