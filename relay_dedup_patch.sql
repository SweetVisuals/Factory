-- Finalizing fix for campaign redundancy and sender consistency
-- 1. Update campaign_progress status constraints to support detailed tracking
ALTER TABLE public.campaign_progress 
DROP CONSTRAINT IF EXISTS campaign_progress_status_check;

ALTER TABLE public.campaign_progress
ADD CONSTRAINT campaign_progress_status_check 
CHECK (status IN ('pending', 'sent', 'failed', 'replied', 'interested', 'unsubscribed', 'bounced', 'skipped_duplicate'));

-- 2. Ensure leads table has unique email constraint (if not already there)
-- This prevents the same email from being added as multiple leads.
-- Note: We use DO block to safely check if it exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_email_key'
  ) THEN
    -- First, remove duplicates if any (keeping the oldest)
    DELETE FROM public.leads l1
    USING public.leads l2
    WHERE l1.id > l2.id 
    AND l1.email = l2.email;
    
    ALTER TABLE public.leads ADD CONSTRAINT leads_email_key UNIQUE (email);
  END IF;
END $$;

-- 3. Update the pending leads RPC to be even more robust
-- This ensures that we NEVER fetch a lead that has already been emailed by ANY campaign
-- if it was marked as sent, replied, etc. globally.
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
    l.status
  FROM campaign_leads cl
  JOIN leads l ON cl.lead_id = l.id
  WHERE cl.campaign_id = campaign_id_param
  -- Lead-level status check
  AND l.status NOT IN ('interested', 'replied', 'unsubscribed', 'bounced', 'invalid', 'do_not_contact')
  -- Global dedup check: Exclude if they received ANY email from ANY campaign in the last 30 days
  -- (except if we are specifically allowing re-targeting, but the user wants to avoid duplicate targeting)
  AND NOT EXISTS (
    SELECT 1 FROM campaign_progress cp 
    WHERE cp.lead_id = l.id 
    AND cp.status = 'sent'
    -- If we want to allow the SAME campaign to follow up, we'd need more logic, 
    -- but here we are excluding if THIS specific step was already sent.
    AND (
        (cp.campaign_id = campaign_id_param AND cp.schedule_id = schedule_id_param)
        OR
        (cp.campaign_id != campaign_id_param AND cp.created_at > NOW() - INTERVAL '30 days')
    )
  )
  -- Also exclude if they were already marked as replied/unsubscribed in ANY campaign
  AND NOT EXISTS (
    SELECT 1 FROM campaign_progress cp
    WHERE cp.lead_id = l.id
    AND cp.status IN ('replied', 'unsubscribed')
  );
END;
$function$;
