import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
console.log('Env Path:', envPath);
console.log('Env exists:', fs.existsSync(envPath));

dotenv.config({ path: envPath });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'DEFINED' : 'UNDEFINED');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'DEFINED' : 'UNDEFINED');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'DEFINED' : 'UNDEFINED');
