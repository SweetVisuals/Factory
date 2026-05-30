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
