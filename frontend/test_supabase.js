import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'ptnmgmt@gmail.com',
        password: 'Longlonglong1!'
    });

    let campaignQuery = supabase.from('campaigns').select('*');
    const { data: campaigns, error } = await campaignQuery;
    console.log('totalProspects:', (campaigns || []).reduce((s, c) => s + (c.prospects || 0), 0));
    console.log('campaign 0 prospects:', campaigns?.[0]?.prospects);
}

test();
