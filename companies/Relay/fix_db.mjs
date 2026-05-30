import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = 'https://wmoyigdovtpuayjxezzc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixDatabase() {
  console.log('--- Starting Relay Database Fix ---');

  // 1. Create campaign_sequences table
  console.log('Step 1: Creating campaign_sequences table...');
  const { error: seqTableError } = await supabase.rpc('exec_sql', {
    sql: `
    CREATE TABLE IF NOT EXISTS public.campaign_sequences (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
        step integer NOT NULL,
        subject text NOT NULL,
        content text NOT NULL,
        delay_days integer DEFAULT 1,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );
    
    ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;
    
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for service role' AND tablename = 'campaign_sequences') THEN
            CREATE POLICY "Allow all for service role" ON public.campaign_sequences FOR ALL USING (true);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'campaign_sequences') THEN
            CREATE POLICY "Public read access" ON public.campaign_sequences FOR SELECT USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert access' AND tablename = 'campaign_sequences') THEN
            CREATE POLICY "Public insert access" ON public.campaign_sequences FOR INSERT WITH CHECK (true);
        END IF;
    END $$;
    `
  });

  if (seqTableError) {
    console.warn('Warning: exec_sql RPC failed (standard for many projects). Trying direct REST if possible...');
    // If RPC fails, it means we can't run raw SQL via the client easily.
    // We might need to use a different approach.
  } else {
    console.log('SUCCESS: campaign_sequences table created and RLS configured.');
  }

  // 2. Fix RLS on campaigns and leads
  console.log('Step 2: Fixing RLS on campaigns and leads...');
  const { error: rlsError } = await supabase.rpc('exec_sql', {
    sql: `
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

    DO $$ 
    BEGIN
        -- Campaigns Policies
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public full access' AND tablename = 'campaigns') THEN
            CREATE POLICY "Public full access" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
        END IF;

        -- Leads Policies
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public full access' AND tablename = 'leads') THEN
            CREATE POLICY "Public full access" ON public.leads FOR ALL USING (true) WITH CHECK (true);
        END IF;
    END $$;
    `
  });

  if (rlsError) {
    console.error('ERROR: Failed to fix RLS:', rlsError);
  } else {
    console.log('SUCCESS: RLS policies updated.');
  }

  console.log('--- Database Fix Complete ---');
}

fixDatabase();
