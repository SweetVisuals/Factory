CREATE TABLE IF NOT EXISTS public.business_opt_outs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.global_blacklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.business_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_blacklist ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Enable read access for all users" ON public.business_opt_outs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.business_opt_outs FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.global_blacklist FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.global_blacklist FOR INSERT WITH CHECK (true);
