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
