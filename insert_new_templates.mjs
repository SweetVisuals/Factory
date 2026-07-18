import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'companies/Relay/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const templates = [
  // Sequence 1: Missed Enquiries
  {
    name: 'Seq 1 - Step 1 - Observation',
    subject: 'quick question',
    content: `Hi {{first_name}}, we work with a lot of businesses in {{location}}, and one thing that comes up constantly is enquiries getting missed or answered late when things get busy. Is that something you deal with too at {{company}}?`
  },
  {
    name: 'Seq 1 - Step 2 - Cost',
    subject: 're: quick question',
    content: `Most businesses don't realise how much this actually costs them until they add it up — a missed enquiry is usually a missed job, and over a few months that adds up fast. Worth thinking about?`
  },
  {
    name: 'Seq 1 - Step 3 - Reveal',
    subject: 'how we help',
    content: `We build simple systems that pick up enquiries and follow-ups automatically, so nothing depends on someone catching it in time. Might be worth a quick look for you.`
  },
  {
    name: 'Seq 1 - Step 4 - Normalizer',
    subject: 'not just you',
    content: `We're speaking with a few other businesses locally this month about this same issue — it's a common gap, not just something specific to you. Happy to share what's worked for others.`
  },
  {
    name: 'Seq 1 - Step 5 - Breakup',
    subject: 'one more thing',
    content: `I'll leave it here — if this isn't a priority right now, no problem at all. If it is, just reply and I'll send over more detail, short and simple.`
  },

  // Sequence 2: Manual Data Entry
  {
    name: 'Seq 2 - Step 1 - Observation',
    subject: 'enquiries',
    content: `Hi {{first_name}}, we see this a lot with teams like yours — staff spending hours a week just moving data between systems or doing manual entry when they're already busy. Is that happening at {{company}}?`
  },
  {
    name: 'Seq 2 - Step 2 - Cost',
    subject: 're: enquiries',
    content: `It usually means your team is backlogged on the work that actually matters, just to keep on top of admin. Over a year, that's a lot of expensive time wasted.`
  },
  {
    name: 'Seq 2 - Step 3 - Reveal',
    subject: 'how we help',
    content: `We set up background automations that handle the manual data work, so your team doesn't have to touch it. Might save you a few headaches.`
  },
  {
    name: 'Seq 2 - Step 4 - Normalizer',
    subject: 'common issue',
    content: `We're actually catching up with a few local companies this week about the exact same manual bottlenecks. It's standard growing pains. Happy to show you the fix.`
  },
  {
    name: 'Seq 2 - Step 5 - Breakup',
    subject: 'following up',
    content: `I'll leave it there. If you're too busy to look at this right now, all good. Just let me know if you ever want to see how it works.`
  },

  // Sequence 3: Follow-ups Falling Through
  {
    name: 'Seq 3 - Step 1 - Observation',
    subject: 'quick question',
    content: `Hi {{first_name}}, a common issue we notice is that initial quotes go out, but the follow-ups slip through the cracks because the team is focused on new work. Does that happen at {{company}}?`
  },
  {
    name: 'Seq 3 - Step 2 - Cost',
    subject: 're: quick question',
    content: `Usually, those un-chased quotes are just left on the table. It's revenue that's already warm, but lost just because nobody had time to send a quick check-in email.`
  },
  {
    name: 'Seq 3 - Step 3 - Reveal',
    subject: 'how we help',
    content: `We build simple automated follow-up sequences that chase those quotes for you, quietly in the background. Might be worth a look.`
  },
  {
    name: 'Seq 3 - Step 4 - Normalizer',
    subject: 'not just you',
    content: `We speak to a lot of businesses in {{location}} dealing with this exact same follow-up gap. It's hard to keep on top of it manually. Happy to share how others handle it.`
  },
  {
    name: 'Seq 3 - Step 5 - Breakup',
    subject: 'one more thing',
    content: `I won't keep emailing. If fixing the follow-up gap isn't on the radar right now, no stress. If it is, just reply and we can chat.`
  },

  // Sequence 4: Backlogged Scheduling
  {
    name: 'Seq 4 - Step 1 - Observation',
    subject: 'enquiries',
    content: `Hi {{first_name}}, we talk to a lot of teams who get stuck in back-and-forth emails just trying to schedule calls or site visits, especially when things are backlogged. Is that a bottleneck for {{company}}?`
  },
  {
    name: 'Seq 4 - Step 2 - Cost',
    subject: 're: enquiries',
    content: `That back-and-forth usually stretches out the sales cycle by days, and sometimes the client just goes quiet. It's a frustrating way to lose a job.`
  },
  {
    name: 'Seq 4 - Step 3 - Reveal',
    subject: 'how we help',
    content: `We put simple, automated booking systems in place so clients can just pick a time that works, without the email ping-pong. Might be useful for your team.`
  },
  {
    name: 'Seq 4 - Step 4 - Normalizer',
    subject: 'common gap',
    content: `We're talking to a few other owners in {{location}} about this exact scheduling friction. It's a very common time-sink. Happy to run you through the solution.`
  },
  {
    name: 'Seq 4 - Step 5 - Breakup',
    subject: 'following up',
    content: `I'll leave it here. If you're happy with how things are running, no problem at all. If you want to speed up the booking side, just let me know.`
  },

  // Sequence 5: Disconnected Systems
  {
    name: 'Seq 5 - Step 1 - Observation',
    subject: 'quick question',
    content: `Hi {{first_name}}, one thing we see constantly is businesses running on three or four different software tools that don't talk to each other. Does {{company}} deal with that too?`
  },
  {
    name: 'Seq 5 - Step 2 - Cost',
    subject: 're: quick question',
    content: `It usually means your team is doing double entry, or things are falling through the cracks between systems. It slows everything down when it gets busy.`
  },
  {
    name: 'Seq 5 - Step 3 - Reveal',
    subject: 'how we help',
    content: `We build custom integrations that connect those systems so they update each other automatically. Might save your team some hassle.`
  },
  {
    name: 'Seq 5 - Step 4 - Normalizer',
    subject: 'not just you',
    content: `We speak with businesses every week who are frustrated by disconnected software. It's a standard issue once you reach a certain size. Happy to show you how we fix it.`
  },
  {
    name: 'Seq 5 - Step 5 - Breakup',
    subject: 'one more thing',
    content: `I'll leave it at that. If integrating those tools isn't a priority, no worries. If it is, just reply and I'll send over some quick info.`
  }
];

async function insertTemplates() {
  console.log(`Inserting ${templates.length} templates...`);
  
  for (const template of templates) {
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...template, campaign_id: 'a4afda48-0e7a-44ae-b6fa-d5e434020847' })
      .select('id, name')
      .single();
    if (error) {
      console.error(`❌ Failed to insert "${template.name}": ${error.message}`);
    } else {
      console.log(`✅ Inserted: ${data.name} (${data.id})`);
    }
  }
  
  const { count } = await supabase.from('templates').select('*', { count: 'exact', head: true });
  console.log(`\nTotal templates now: ${count}`);
}

insertTemplates();