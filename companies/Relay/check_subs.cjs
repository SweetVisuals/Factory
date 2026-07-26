const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:54322/postgres' });
client.connect().then(async () => {
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'account_settings'");
  console.log(res.rows);
  process.exit(0);
});
