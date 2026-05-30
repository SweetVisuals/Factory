const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.SUPABASE_URL.replace('https://', 'postgresql://postgres:').replace('.supabase.co', '') + '.supabase.co:5432/postgres'; // this is usually wrong for supabase, wait, supabase standard connection string is different.

// Actually let's use the standard SUPABASE DB URL if it exists in .env, or fetch it.
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/DATABASE_URL=(.*)/);

async function main() {
    if (!match) {
        console.error("No DATABASE_URL found in .env");
        process.exit(1);
    }
    const client = new Client({
        connectionString: match[1]
    });
    
    await client.connect();
    console.log("Connected to DB.");

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.business_tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
                step_number INTEGER NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', 
                assigned_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
                UNIQUE(business_id, step_number)
            );
        `);
        console.log("Table created.");

        // Safe alter publication
        try {
            await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE business_tasks;`);
            console.log("Added to publication.");
        } catch(e) {
            console.log("Could not alter publication (may already exist):", e.message);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
