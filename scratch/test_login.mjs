import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDU4NDgsImV4cCI6MjA5NDAyMTg0OH0.qj-lYdhiyYuHy_T4RYFydc9adK4Mu_uLr0t1s1i8oRk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing login...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'admin123'
  });
  if (error) {
    console.error('Login error:', error);
  } else {
    console.log('Login success:', data);
  }
}
test();
