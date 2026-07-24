const { Client } = require('ssh2');

const sqlScript = `
-- 1. Fix user ownership
UPDATE campaigns SET user_id = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1' WHERE user_id = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
UPDATE leads SET user_id = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1' WHERE user_id = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
UPDATE email_accounts SET user_id = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1' WHERE user_id = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';
UPDATE email_tones SET user_id = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1' WHERE user_id = 'c5f44ad2-63d1-43c2-8e17-0333d12e8643';

-- 2. Create account_settings table
CREATE TABLE IF NOT EXISTS account_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
    is_scraping_active boolean DEFAULT false,
    plan_type text DEFAULT 'free',
    scrapes_this_month integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. RLS for account_settings
ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own account_settings" ON account_settings;
CREATE POLICY "Users can manage own account_settings" ON account_settings FOR ALL USING (auth.uid() = user_id);

-- 4. Create trigger to insert default settings for new users (and run it for existing)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.account_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Manually insert for existing users
INSERT INTO public.account_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Make sure ptnmgmt has it on
UPDATE account_settings SET is_scraping_active = true WHERE user_id = 'bc3210f9-f8fd-4732-972b-f49cea68d3c1';
`;

const conn = new Client();
conn.on('ready', () => {
  const cmd = `docker exec -i supabase-db psql -U postgres -d postgres < /dev/stdin`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (c) => {
      console.log('Done code:', c);
      conn.end();
    })
    .on('data', d => console.log(d.toString()))
    .stderr.on('data', d => console.error(d.toString()));
    stream.write(sqlScript);
    stream.end();
  });
}).connect({ host: '5.75.252.100', port: 22, username: 'root', password: 'UPCWbqAvcAnW', readyTimeout: 60000 });
