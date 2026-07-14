import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

async function check() {
  const dbUrl = process.env.SUPABASE_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', ':5432/postgres');
  console.log("No pg available, checking via REST API");
}
check();
