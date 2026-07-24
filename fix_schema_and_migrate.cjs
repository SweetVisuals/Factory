const { Client } = require('ssh2');

const conn = new Client();
const HOST = '5.75.252.100';
const USER = 'root';
const PASS = 'UPCWbqAvcAnW';

console.log('🔗 Connecting to Hetzner...');

conn.on('ready', () => {
  console.log('✅ SSH connected.');
  
  const cmd = `
    echo "Fixing schema for data migration..."
    docker exec -i supabase-db psql -U postgres -d postgres <<EOF
      -- 1. Insert the missing user into auth.users so foreign keys don't fail
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) 
      VALUES ('c5f44ad2-63d1-43c2-8e17-0333d12e8643', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@local.test', '', now(), now(), now(), '', '', '', '') 
      ON CONFLICT DO NOTHING;

      -- 2. Add missing 'pitch' column
      ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS pitch text;
EOF
    echo "Schema fixed. Now running data migration again..."
    docker exec -i supabase-db psql -U postgres -d postgres < /root/migration_full.sql
    echo "🎉 Data migration applied successfully!"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('--- Fix & Migration Finished ---');
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 60000
});
