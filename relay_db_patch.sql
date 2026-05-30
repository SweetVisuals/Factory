-- ==========================================
-- RELAY INFRASTRUCTURE & SECURITY PATCH
-- ==========================================

-- 1. Create campaign_sequences table
CREATE TABLE IF NOT EXISTS public.campaign_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    subject TEXT,
    step_1 TEXT,
    step_2 TEXT,
    step_3 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id)
);

-- 2. Add user_id to leads if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='user_id') THEN
        ALTER TABLE public.leads ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- 4. Clean up existing policies
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can manage their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can manage their campaign leads" ON public.campaign_leads;
DROP POLICY IF EXISTS "Users can manage their sequences" ON public.campaign_sequences;
DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can manage chat logs" ON public.chat_logs;

-- 5. Define Secure Policies

-- Campaigns: Strict owner access
CREATE POLICY "Users can view their own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- Leads: Strict owner access
CREATE POLICY "Users can manage their own leads" ON public.leads FOR ALL USING (auth.uid() = user_id);

-- Campaign Leads Junction: Based on campaign ownership
CREATE POLICY "Users can manage their campaign leads" ON public.campaign_leads FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE campaigns.id = campaign_leads.campaign_id 
        AND campaigns.user_id = auth.uid()
    )
);

-- Campaign Sequences: Strict owner access
CREATE POLICY "Users can manage their sequences" ON public.campaign_sequences FOR ALL USING (auth.uid() = user_id);

-- Tasks & Logs: Global factory access (Authenticated or Service Role)
CREATE POLICY "Authenticated users can manage tasks" ON public.tasks FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Authenticated users can manage chat logs" ON public.chat_logs FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 6. Helper Functions for Scraper

-- Get leads not yet assigned to any campaign
CREATE OR REPLACE FUNCTION get_unmanaged_leads(p_user_id UUID)
RETURNS SETOF leads AS $$
BEGIN
  RETURN QUERY
  SELECT l.*
  FROM leads l
  LEFT JOIN campaign_leads cl ON l.id = cl.lead_id
  WHERE l.user_id = p_user_id AND cl.lead_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear leads not assigned to any campaign
CREATE OR REPLACE FUNCTION clear_unmanaged_leads(p_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM leads
  WHERE user_id = p_user_id
  AND id NOT IN (SELECT lead_id FROM campaign_leads);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
