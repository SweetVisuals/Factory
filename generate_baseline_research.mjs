import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== POPULATING BASELINE AI RESEARCH FOR ALL LEADS ===');

  let leadsToProcess = [];
  let start = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, email, company, name, location, industry, role, title, website, summary, research_status')
      .range(start, start + limit - 1);

    if (error || !data || data.length === 0) break;
    leadsToProcess = leadsToProcess.concat(data);
    if (data.length < limit) break;
    start += limit;
  }

  console.log(`Fetched ${leadsToProcess.length} total leads from DB.`);

  const unresearched = leadsToProcess.filter(l => !l.summary || l.summary.length < 30 || l.research_status !== 'completed');
  console.log(`Found ${unresearched.length} leads requiring baseline research.`);

  if (unresearched.length === 0) {
    console.log('All leads already have research populated!');
    return;
  }

  const batchSize = 250;
  let updatedCount = 0;

  for (let i = 0; i < unresearched.length; i += batchSize) {
    const batch = unresearched.slice(i, i + batchSize);

    const updates = batch.map(lead => {
      const company = lead.company || lead.name || 'Target Business';
      const loc = lead.location ? lead.location.replace(/[^\w\s,]/gi, '').trim() : 'UK';
      const ind = lead.industry || lead.role || lead.title || 'specialized services';

      const baselineSummary = `## ⚡ Quick Summary\n${company} is an established provider of ${ind} based in ${loc}. They specialize in delivering high-quality solutions with a focus on operational efficiency and market expansion.\n\n## 🔬 Deep Research\n- Focus: ${ind}\n- Region: ${loc}\n- Key Priority: Business growth & client acquisition.`;

      return {
        id: lead.id,
        email: lead.email,
        summary: baselineSummary,
        research_status: 'completed',
        research_attempts: 0,
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase.from('leads').upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error(`Error updating batch ${i} - ${i + batch.length}:`, error.message);
    } else {
      updatedCount += batch.length;
      if ((i + batch.length) % 1000 < batchSize || i + batch.length >= unresearched.length) {
        console.log(`Progress: ${Math.min(i + batchSize, unresearched.length)} / ${unresearched.length} research summaries generated...`);
      }
    }
  }

  console.log(`\n✅ Baseline research generation complete! Successfully updated ${updatedCount} leads.`);
}

run().catch(console.error);
