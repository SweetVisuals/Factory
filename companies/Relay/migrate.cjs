const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:Longlonglong1!@db.fzcrjogrnujrfxafxbkh.supabase.co:5432/postgres' });
client.connect()
  .then(() => client.query('ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS aims_md TEXT;'))
  .then(() => client.query('ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS objectives_md TEXT;'))
  .then(() => client.query('ALTER TABLE email_tones ADD COLUMN IF NOT EXISTS category TEXT;'))
  .then(() => { console.log('Migration applied successfully'); client.end(); })
  .catch(e => { console.error('Migration error:', e); client.end(); });
