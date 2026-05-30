import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('c:/Users/Shadow/Desktop/Openclaw Factory/companies/Relay/.env') });

const supabaseUrl = process.env.VITE_OPENCLAW_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_OPENCLAW_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: campaigns } = await supabase.from('campaigns').select('id, name, business_id');
    console.log('All Campaigns:', campaigns);

    const { data: accounts } = await supabase.from('email_accounts').select('id, email');
    console.log('All Email Accounts:', accounts);
}
check();
