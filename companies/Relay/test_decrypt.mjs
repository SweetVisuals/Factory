import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: accounts } = await supabase
    .from('email_accounts')
    .select('id, email, encrypted_password')
    .limit(3);

  if (accounts) {
      for (const a of accounts) {
          const { data: decrypted, error } = await supabase.rpc('decrypt_password', { 
             encrypted_password: a.encrypted_password 
          });
          console.log(`Email: ${a.email} | Decrypted: ${decrypted ? 'YES (length ' + decrypted.length + ')' : 'NO'} | Error: ${error?.message || 'none'}`);
          if (decrypted) {
             console.log(`  -> First 2 chars: ${decrypted.substring(0, 2)}...`);
          }
      }
  } else {
      console.log('No accounts found or RLS blocked.');
  }
}
main();
