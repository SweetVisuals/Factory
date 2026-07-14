import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  // 1. Fix leads that have "Ethan" in personalized_email
  const { data: ethanLeads } = await supabase
    .from('leads')
    .select('id, personalized_email')
    .ilike('personalized_email', '%Ethan%')
    .not('personalized_email', 'is', null);
  
  console.log(`Found ${ethanLeads?.length || 0} leads with "Ethan" in personalized_email`);
  
  let fixed = 0;
  for (const lead of (ethanLeads || [])) {
    let cleaned = lead.personalized_email;
    cleaned = cleaned.replace(/\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care),?\s*\n\s*(Ethan|Ethan Hale)\b[\s\S]{0,200}$/i, '');
    cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*\n.*Relay\s*Solutions[\s\S]{0,200}$/i, '');
    cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*$/i, '');
    cleaned = cleaned.trimEnd();
    
    if (cleaned !== lead.personalized_email) {
      await supabase.from('leads').update({ personalized_email: cleaned }).eq('id', lead.id);
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} leads`);

  // 2. Fix templates that have "Ethan" in content
  const { data: ethanTemplates } = await supabase
    .from('templates')
    .select('id, name, content')
    .ilike('content', '%Ethan%');
  
  console.log(`Found ${ethanTemplates?.length || 0} templates with "Ethan" in content`);
  
  let tFixed = 0;
  for (const t of (ethanTemplates || [])) {
    let cleaned = t.content;
    cleaned = cleaned.replace(/\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care),?\s*\n\s*(Ethan|Ethan Hale)\b[\s\S]{0,200}$/i, '');
    cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*\n.*Relay\s*Solutions[\s\S]{0,200}$/i, '');
    cleaned = cleaned.replace(/\n*\s*Ethan\s*\n/gi, '\n');
    cleaned = cleaned.replace(/\n*\s*(Ethan|Ethan Hale)\s*$/i, '');
    cleaned = cleaned.trimEnd();
    
    if (cleaned !== t.content) {
      await supabase.from('templates').update({ content: cleaned }).eq('id', t.id);
      tFixed++;
      console.log(`  Fixed template: ${t.name}`);
    }
  }
  console.log(`Fixed ${tFixed} templates`);

  // 3. Fix leads with "there" as personalized_subject
  const { data: thereLeads } = await supabase
    .from('leads')
    .select('id, personalized_subject')
    .ilike('personalized_subject', '%there —%')
    .not('personalized_subject', 'is', null);
  
  console.log(`\nFound ${thereLeads?.length || 0} leads with "there" in subject`);
  // Clear their personalized content so the template fallback kicks in fresh
  for (const lead of (thereLeads || [])) {
    await supabase.from('leads').update({ personalized_email: null, personalized_subject: null }).eq('id', lead.id);
  }
  console.log('Cleared personalized content for "there" leads — template fallback will regenerate them.');
}

fix();
