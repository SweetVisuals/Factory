const fs = require('fs');

async function run() {
    const { default: postgres } = await import('postgres');
    const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');

    try {
        console.log("Executing Data Migration (migration_full.sql) with replication role...");
        const data = fs.readFileSync('migration_full.sql', 'utf8');
        try {
            await sql.unsafe(`
                SET session_replication_role = replica;
                ${data}
                SET session_replication_role = DEFAULT;
            `);
            console.log("Data Migration complete.");
        } catch(err) {
            console.error("Data Migration Error:", err.message);
        }

    } catch (e) {
        console.error("Migration Fatal Error:", e);
    } finally {
        await sql.end();
    }
}

run();
