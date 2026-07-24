ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON leads;
CREATE POLICY "Enable read access for all users" ON leads FOR SELECT USING (true);
