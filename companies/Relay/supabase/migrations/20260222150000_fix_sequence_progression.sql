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
