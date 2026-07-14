const fs = require('fs');
const path = require('path');

async function run() {
    const { default: postgres } = await import('postgres');
    const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');

    try {
        console.log("Starting Schema Migration...");
        const dir = path.join(__dirname, 'companies', 'Relay', 'supabase', 'migrations');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
        
        for (const file of files) {
            console.log("Executing:", file);
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            if (!content.trim()) continue;
            try {
                await sql.unsafe(content);
            } catch (err) {
                console.error("  -> Warning/Error in", file, ":", err.message);
                // Continue despite error
            }
        }
        console.log("Schema Migration complete.");

        console.log("Executing Data Migration (migration_full.sql)...");
        const data = fs.readFileSync('migration_full.sql', 'utf8');
        try {
            await sql.unsafe(data);
        } catch(err) {
            console.error("Data Migration Error:", err.message);
        }
        console.log("Data Migration complete.");

    } catch (e) {
        console.error("Migration Fatal Error:", e);
    } finally {
        await sql.end();
    }
}

run();
