import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'ptnmgmt@gmail.com',
    password: 'Longlonglong1!'
  });
  if (!authData) return;
  
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const { data: logs, error } = await client
    .from('chat_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    return;
  }

  const extractThoughtAndMessage = (fullMessage) => {
    const thoughtMatch = fullMessage.match(/<thought>([\s\S]*?)<\/thought>/);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
    const message = fullMessage.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    return { thought, message };
  };

  const filtered = logs.filter(log => {
    const { message } = extractThoughtAndMessage(log.message);
    const isConversational = /^(Understood|I've delegated|I have delegated|The Market Researcher|I will acknowledge|I am now awaiting|I have completed|I'll get to work)/i.test(message.trim());
    const isShort = message.length < 300;
    const lacksMarkdown = !/(# |\*\*|- |\|)/.test(message);
    const isDelegationTemplate = /(DELEGATE:|FINAL NUCLEAR DELEGATION|Your sole task is|Use PIXAZO:|Replace `PIXAZO:|Generate the images via PIXAZO|PIXAZO prompt:|compile them into the slideshow)/i.test(message);

    return !isShort && !isConversational && !lacksMarkdown && !isDelegationTemplate;
  });

  console.log(`Found ${filtered.length} substantial logs:`);
  for (const log of filtered.slice(0, 10)) {
    const { message } = extractThoughtAndMessage(log.message);
    const lines = message.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const headerLine = lines.find(l => l.startsWith('#'));
    const fallbackLine = lines.find(l => !l.startsWith('<') && !l.startsWith('To:') && !l.startsWith('Subject:'));
    
    let title = 'Untitled Deliverable';
    if (headerLine) {
      title = headerLine.replace(/^#+\s*/, '');
    } else if (fallbackLine) {
      title = fallbackLine.replace(/[#*`]/g, '');
      if (title.length > 50) title = title.substring(0, 50) + '...';
    }

    console.log(`- Agent: ${log.agent_name}`);
    console.log(`  Extracted Title: "${title}"`);
    console.log(`  First 3 lines of message:`);
    console.log(lines.slice(0, 3).map(l => `    > ${l}`).join('\n'));
    console.log('------------------------------------');
  }
}

main().catch(console.error);
