import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: campaigns, error } = await supabase.from('campaigns').select('*').eq('business_id', '0269fe06-4607-4c58-9263-12a3930a1dc3');
  console.log("Campaigns for MrMedic (ANON):", campaigns ? campaigns.length : 0);
  console.log("Error:", error);
}
check();
