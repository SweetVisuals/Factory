import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');
  
  try {
    console.log("Checking and adding signatures column to email_accounts...");
    await sql`
      ALTER TABLE email_accounts 
      ADD COLUMN IF NOT EXISTS signatures jsonb DEFAULT '[]'::jsonb;
    `;
    console.log("Column signatures added successfully!");
  } catch (error) {
    console.error("Error adding column:", error);
  } finally {
    await sql.end();
  }
}

main();
