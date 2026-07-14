import postgres from 'postgres';
import fs from 'fs';

const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');

async function run() {
    try {
        console.log("Starting Database Migration...");

        console.log("Executing Schema Migration (schema_migration.sql)...");
        const schema = fs.readFileSync('schema_migration.sql', 'utf8');
        await sql.unsafe(schema);
        console.log("Schema Migration complete.");

        console.log("Executing Data Migration (migration_full.sql)...");
        const data = fs.readFileSync('migration_full.sql', 'utf8');
        await sql.unsafe(data);
        console.log("Data Migration complete.");

    } catch (e) {
        console.error("Migration Error:", e);
    } finally {
        await sql.end();
    }
}

run();
