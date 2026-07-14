const fs = require('fs');
async function run() {
    const { default: postgres } = await import('postgres');
    const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');
    try {
        await sql.unsafe(`NOTIFY pgrst, 'reload schema'`);
        console.log('PostgREST schema cache reloaded.');
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}
run();
