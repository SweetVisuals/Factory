import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Signing up admin...');
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@gmail.com',
    password: 'admin123'
  });
  if (error) {
    console.error('Sign up error (might already exist):', error.message);
  } else {
    console.log('Signed up successfully:', data);
  }
}
run();
