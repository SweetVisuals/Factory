import fs from 'fs';

async function run() {
  console.log('=== CHECKING SQL AND JSON MIGRATION FILES ===');

  if (fs.existsSync('relay_migration_data.json')) {
    const data = JSON.parse(fs.readFileSync('relay_migration_data.json', 'utf8'));
    console.log('relay_migration_data.json:');
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        console.log(`  ${key}: ${val.length} items`);
      }
    }
  }

  // Check migration_full.sql size and occurrences
  if (fs.existsSync('migration_full.sql')) {
    const stat = fs.statSync('migration_full.sql');
    console.log(`migration_full.sql size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  }

  if (fs.existsSync('leads_chunk_1.sql')) {
    const stat = fs.statSync('leads_chunk_1.sql');
    console.log(`leads_chunk_1.sql size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  }
}

run().catch(console.error);
