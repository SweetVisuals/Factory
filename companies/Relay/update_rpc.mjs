import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3lpZ2RvdnRwdWF5anhlenpjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcxOTMwMywiZXhwIjoyMDg1Mjk1MzAzfQ.lutBH8ZXbQ3LcYDGKvk3i-7PKm64FgO5OUL9j4NOz3Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateRPC() {
    console.log('Updating RPC get_pending_campaign_leads...');
    const { error } = await supabase.rpc('execute_sql', {
        query: `
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
  -- Exclude invalid or non-outreach statuses
  AND l.status NOT IN ('interested', 'replied', 'unsubscribed', 'bounced', 'invalid', 'do_not_contact')
  AND NOT EXISTS (
    -- Exclude if they received THIS specific step
    SELECT 1 FROM campaign_progress cp 
    WHERE cp.campaign_id = campaign_id_param 
    AND cp.schedule_id = schedule_id_param
    AND cp.lead_id = l.id 
    AND cp.status IN ('sent', 'replied', 'unsubscribed')
  );
END;
$function$;
        `
    });

    if (error) {
        console.error('Error updating RPC:', error);
        // Fallback: maybe there is no execute_sql RPC?
        console.log('Attempting via direct query if possible...');
    } else {
        console.log('Successfully updated RPC!');
    }
}

updateRPC();
