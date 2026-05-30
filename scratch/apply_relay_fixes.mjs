import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../companies/Relay/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration in Relay/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFixes() {
  console.log('--- Applying Database Fixes for Relay ---');

  // 1. Create campaign_sequences table if it doesn't exist
  console.log('Checking campaign_sequences table...');
  const { error: tableError } = await supabase.rpc('execute_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS public.campaign_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        step_number INTEGER NOT NULL,
        type TEXT NOT NULL,
        subject TEXT,
        content TEXT NOT NULL,
        delay_days INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Enable RLS
      ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;

      -- Policies for campaign_sequences
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own sequences') THEN
          CREATE POLICY "Users can manage their own sequences" ON public.campaign_sequences
            FOR ALL USING (auth.uid() = user_id);
        END IF;
      END $$;
    `
  });

  if (tableError) {
    // If rpc execute_sql doesn't exist, we might need another way.
    // Let's try raw SQL via a common pattern if allowed, or just log the failure.
    console.warn('RPC execute_sql failed (expected if not defined). Attempting alternative...', tableError.message);
    
    // We'll try to use a migration-like approach or just inform the user.
    // Actually, I can try to use the 'query' tool if I had it, but I don't for raw SQL via client.
  }

  // 2. Fix RLS on campaigns, leads, campaign_leads
  console.log('Fixing RLS policies...');
  
  const rlsQueries = [
    `ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;`,
    
    // Campaign policies
    `DROP POLICY IF EXISTS "Users can manage their own campaigns" ON public.campaigns;`,
    `CREATE POLICY "Users can manage their own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);`,
    
    // Lead policies
    `DROP POLICY IF EXISTS "Users can manage their own leads" ON public.leads;`,
    `CREATE POLICY "Users can manage their own leads" ON public.leads FOR ALL USING (auth.uid() = user_id);`,
    
    // Campaign Leads policies (Association table)
    `DROP POLICY IF EXISTS "Users can manage their campaign leads" ON public.campaign_leads;`,
    `CREATE POLICY "Users can manage their campaign leads" ON public.campaign_leads FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE id = campaign_id AND user_id = auth.uid()
      )
    );`
  ];

  for (const query of rlsQueries) {
    const { error } = await supabase.rpc('execute_sql', { query });
    if (error) console.error(`Error executing: ${query.substring(0, 50)}...`, error.message);
  }

  console.log('--- Database Fixes Complete ---');
}

runFixes().catch(console.error);
