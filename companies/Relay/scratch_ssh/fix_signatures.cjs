const { Client } = require('ssh2');

const conn = new Client();

const COMMANDS = `
cd /root/Factory/companies/Relay
git pull

# Clean all campaign_sequences templates that have hardcoded signatures
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanTemplates() {
  const { data: seqs, error } = await client.from('campaign_sequences').select('id, content');
  if (error) { console.error('Error:', error.message); return; }
  
  let fixed = 0;
  for (const seq of seqs) {
    if (!seq.content) continue;
    let c = seq.content;
    const original = c;
    
    // Strip any 'Name\\nRelay Solutions\\nwww.relaysolutions.net' blocks
    c = c.replace(/\\n+\\s*[A-Z][a-z]+\\s*\\nRelay Solutions[\\s\\S]*$/i, '');
    // Strip 'Ethan\\nRelay Solutions' specifically  
    c = c.replace(/\\n+\\s*Ethan[\\s\\S]*$/i, '');
    // Strip any trailing greeting + name + company blocks
    c = c.replace(/\\n*\\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care),?\\s*\\n[\\s\\S]{0,200}$/i, '');
    // Strip www.relaysolutions.net
    c = c.replace(/\\n*\\s*(?:www\\.)?relaysolutions\\.net[\\s\\S]*$/i, '');
    
    c = c.trimEnd();
    
    if (c !== original) {
      const { error: updateErr } = await client.from('campaign_sequences').update({ content: c }).eq('id', seq.id);
      if (!updateErr) fixed++;
      else console.error('Update error for', seq.id, updateErr.message);
    }
  }
  console.log('Cleaned', fixed, 'templates out of', seqs.length, 'total');
}
cleanTemplates();
"

sleep 3
pm2 restart all
sleep 2
pm2 logs --lines 5 --nostream
`;

conn.on('ready', () => {
  console.log('Connected');
  conn.exec(COMMANDS, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Done, exit code:', code);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '5.75.252.100',
  port: 22,
  username: 'root',
  password: 'mjaXRVMmbMwC7xCbcLCE123',
  readyTimeout: 60000
});
