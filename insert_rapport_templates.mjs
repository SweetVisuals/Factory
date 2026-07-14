import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const templates = [
  {
    name: 'Rapport - Curious Opener',
    step_number: 1,
    subject: '{{first_name}} — random question',
    content: `{{first_name}},

Weird one — if you could snap your fingers and automate one thing at {{company}} tomorrow, what would it be?

We build stuff like that at Relay. Just curious what yours would be.`
  },
  {
    name: 'Rapport - Day in the Life',
    step_number: 1,
    subject: 'What eats up your day?',
    content: `{{first_name}},

Genuine question — what's the one task at {{company}} that makes you think "there has to be a better way to do this"?

We hear that a lot from people in {{location}}. Sometimes it's invoicing, sometimes it's chasing clients, sometimes it's just keeping track of everything.

No pitch — just curious.`
  },
  {
    name: 'Rapport - Honest Intro',
    step_number: 1,
    subject: '{{first_name}} — not trying to sell you anything',
    content: `{{first_name}},

I'll be upfront — I'm not going to pretend we've met or that I've got some magical insight about {{company}}.

I run a small automation shop called Relay. We build systems that handle the boring stuff so business owners don't have to. That's basically it.

If that sounds interesting, cool. If not, also cool. Either way, hope business is going well.`
  },
  {
    name: 'Rapport - The Admin Rant',
    step_number: 1,
    subject: 'Quick rant about admin',
    content: `{{first_name}},

Can we all just agree that admin is the worst part of running a business? Nobody starts a company thinking "I can't wait to spend 3 hours a day on spreadsheets."

That's literally why we built Relay — to kill the admin so you can focus on the actual work.

Anyway, rant over. How's {{company}} doing?`
  },
  {
    name: 'Rapport - Simple Question',
    step_number: 1,
    subject: '{{first_name}} — one quick thing',
    content: `{{first_name}},

Not going to write you an essay. Just one question:

Is there anything at {{company}} that you're still doing manually that you wish ran on autopilot?

If yes, that's what we do at Relay. If no, fair play — you're ahead of most.`
  },
  {
    name: 'Rapport - Behind the Scenes',
    step_number: 1,
    subject: 'How does {{company}} actually run day to day?',
    content: `{{first_name}},

I'm always curious about how businesses actually run behind the scenes. The website tells one story but the reality is usually spreadsheets, WhatsApp groups, and a prayer.

No judgement — most businesses run that way. We just help tidy it up when people get fed up with it.

What does the day-to-day look like at {{company}}?`
  },
  {
    name: 'Rapport - Bottleneck',
    step_number: 1,
    subject: '{{first_name}} — what slows you down?',
    content: `{{first_name}},

Every business has that one bottleneck — the thing that slows everything else down. For some it's lead follow-up, for others it's scheduling, some it's just getting paid on time.

What's yours at {{company}}? Genuinely curious.

We're Relay — we build systems to fix exactly that kind of thing.`
  },
  {
    name: 'Rapport - No Fluff',
    step_number: 1,
    subject: 'Keeping it short',
    content: `{{first_name}},

Three things about Relay:

1. We build custom automation for businesses
2. You own it — no monthly fees
3. It handles the stuff your team shouldn't be wasting time on

That's it. If any of that sounds relevant to {{company}}, I'm around. If not, no stress.`
  },
  {
    name: 'Rapport - The Honest Check-In',
    step_number: 1,
    subject: '{{first_name}} — how are things going?',
    content: `{{first_name}},

Not a sales pitch, just a genuine check-in. How's business going for {{company}} in {{location}} at the moment?

We work with a lot of businesses in the area and I'm always curious what's working and what's a headache. If you ever want to bounce ideas around, my inbox is open.

Nicolas @ Relay`
  },
  {
    name: 'Rapport - Tech Stack',
    step_number: 1,
    subject: '{{first_name}} — what tools are you using?',
    content: `{{first_name}},

Quick question — what's {{company}} currently using to manage the day-to-day? CRM? Spreadsheets? Post-it notes? (No judgement, I've seen it all.)

We build custom systems at Relay that replace the patchwork of tools most businesses end up with. But I'm curious what your setup looks like first.`
  },
  {
    name: 'Rapport - Growth Pain',
    step_number: 1,
    subject: '{{first_name}} — growing pains?',
    content: `{{first_name}},

Most businesses I talk to in {{location}} are in this weird spot where they're growing but their systems aren't keeping up. More clients, same processes, same tools — it just starts creaking.

Sound familiar at {{company}}? Or have you got it all figured out? Either way, I'd love to hear how you're handling it.`
  },
  {
    name: 'Rapport - Weekend Test',
    step_number: 1,
    subject: '{{first_name}} — quick thought',
    content: `{{first_name}},

Here's a test: do you think about work stuff on weekends because something at {{company}} isn't running smoothly when you're not there?

If yes — that's usually a systems problem, not a people problem. And that's what Relay fixes.

If no — honestly, respect. Teach me your ways.`
  },
  {
    name: 'Rapport - Real Talk',
    step_number: 1,
    subject: 'Real talk, {{first_name}}',
    content: `{{first_name}},

I'm going to skip the corporate speak. Here's what Relay actually does:

We look at the repetitive stuff your team does every day and build a system that does it automatically. Quotes, follow-ups, scheduling, reporting — whatever's eating up time.

You keep the system forever. No subscriptions.

If {{company}} has stuff like that going on, worth a chat. If not, no drama.`
  },
  {
    name: 'Rapport - Two Types',
    step_number: 1,
    subject: '{{first_name}} — which one are you?',
    content: `{{first_name}},

In my experience there are two types of business owners:

1. The ones drowning in admin and manual tasks but "used to it"
2. The ones who automated that stuff and wonder why they didn't do it sooner

No idea which camp {{company}} falls into — but if it's number 1, we should probably talk.

Either way, hope things are going well.`
  },
  {
    name: 'Rapport - Coffee Chat Energy',
    step_number: 1,
    subject: '{{first_name}} — if we were having a coffee',
    content: `{{first_name}},

If we were sat down for a coffee, I'd probably ask you this:

"What's the one thing at {{company}} that drives you mad every week?"

Because whatever that thing is — there's usually a way to automate it or at least make it way less painful. That's what we do at Relay.

No meeting needed. Just reply and tell me what it is. Genuinely curious.`
  }
];

async function insertTemplates() {
  console.log(`Inserting ${templates.length} rapport templates...`);
  
  for (const template of templates) {
    const { data, error } = await supabase
      .from('templates')
      .insert(template)
      .select('id, name')
      .single();
    
    if (error) {
      console.error(`❌ Failed: "${template.name}": ${error.message}`);
    } else {
      console.log(`✅ ${data.name}`);
    }
  }
  
  const { count } = await supabase.from('templates').select('*', { count: 'exact', head: true });
  console.log(`\nTotal templates now: ${count}`);
}

insertTemplates();
