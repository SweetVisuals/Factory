import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/companies/Relay/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 25 generic cold outreach templates for Relay Solutions
// Each uses {{first_name}}, {{company}}, {{location}} placeholders
// Designed to work WITHOUT AI personalization — just code-based replacement

const templates = [
  // ─── STEP 1: HOOKS (Initial outreach) ──────────────────────────────
  {
    name: 'Generic Hook - Time Savings',
    step_number: 1,
    subject: '{{first_name}} — quick question about {{company}}',
    content: `{{first_name}},

I noticed {{company}} is still handling a lot of processes manually. Most businesses in {{location}} we talk to are losing 10-15 hours a week on admin that could be automated.

Would it be worth a quick chat to see if we can help?

If this isn't relevant, no worries — just let me know.`
  },
  {
    name: 'Generic Hook - Cost Angle',
    step_number: 1,
    subject: '{{first_name}} — cutting operational costs at {{company}}',
    content: `{{first_name}},

We help businesses like {{company}} replace expensive monthly software subscriptions with custom-built systems you own outright. No per-seat fees, no data leaving your servers.

Interested in a quick overview of how it works?`
  },
  {
    name: 'Generic Hook - Competitor Angle',
    step_number: 1,
    subject: 'How other firms in {{location}} are automating',
    content: `{{first_name}},

A few businesses in {{location}} similar to {{company}} have started automating their client intake and follow-up processes. The ones who moved first are seeing noticeably better response rates.

Happy to show you what they're doing if you're curious — no pitch, just a walkthrough.`
  },
  {
    name: 'Generic Hook - Direct Value',
    step_number: 1,
    subject: '{{first_name}} — less admin, more revenue',
    content: `{{first_name}},

Quick one — we build custom automation systems for businesses like {{company}}. Things like automated invoicing, client follow-ups, and lead tracking that run on autopilot.

The difference is you own the system outright. No monthly fees, no vendor lock-in.

Worth 10 minutes to see if it fits?`
  },
  {
    name: 'Generic Hook - Pain Point',
    step_number: 1,
    subject: 'Thought this might help {{company}}',
    content: `{{first_name}},

Most business owners I speak to in {{location}} tell me the same thing — they're spending too much time on repetitive tasks that don't directly generate revenue.

We fix that. Custom automation, built specifically for your workflow.

Would a short call make sense?`
  },
  // ─── STEP 2: FOLLOW-UPS ────────────────────────────────────────────
  {
    name: 'Generic Follow-up - Nudge',
    step_number: 2,
    subject: 'Re: {{first_name}} — quick question about {{company}}',
    content: `{{first_name}},

Just bumping this up in case it got buried. Happy to keep it brief — 10 minutes max.

We've helped similar businesses in {{location}} automate their most time-consuming admin. The system runs on your own infrastructure, no ongoing fees.

Still open to a quick chat?`
  },
  {
    name: 'Generic Follow-up - Social Proof',
    step_number: 2,
    subject: 'Re: How other firms in {{location}} are automating',
    content: `{{first_name}},

Just a quick follow-up. One of our clients cut their admin time by 60% within the first month. They were handling everything manually before — scheduling, invoicing, client comms.

If {{company}} is dealing with anything similar, happy to walk you through what we built for them.`
  },
  {
    name: 'Generic Follow-up - Specific Benefit',
    step_number: 2,
    subject: 'Re: {{first_name}} — less admin, more revenue',
    content: `{{first_name}},

To give you a clearer picture — we recently built a system for a business in {{location}} that automated their entire lead follow-up process. They went from manually chasing every enquiry to having it handled automatically.

No generic SaaS. Built specifically for their workflow. Would something like that be useful for {{company}}?`
  },
  {
    name: 'Generic Follow-up - Casual',
    step_number: 2,
    subject: 'Re: Thought this might help {{company}}',
    content: `{{first_name}},

Totally understand if the timing isn't right. Just wanted to flag — we're currently taking on a few projects in {{location}} and have some capacity.

If automating any part of {{company}}'s operations is on your radar, I'm here. If not, no worries at all.`
  },
  {
    name: 'Generic Follow-up - Question',
    step_number: 2,
    subject: 'Quick question, {{first_name}}',
    content: `{{first_name}},

Out of curiosity — what's the biggest time drain for your team at {{company}} right now? Scheduling? Client follow-ups? Reporting?

We specialise in building automation around exactly those bottlenecks. Just reply with whichever one and I'll send over a quick breakdown of what we could do.`
  },
  // ─── STEP 3: VALUE ADD ─────────────────────────────────────────────
  {
    name: 'Generic Value - Ownership Pitch',
    step_number: 3,
    subject: '{{first_name}} — owning vs renting your software',
    content: `{{first_name}},

One thing worth mentioning — every system we build is owned entirely by you. No monthly subscriptions, no per-user fees, no vendor lock-in.

Most businesses in {{location}} are paying thousands annually for tools they don't even fully use. We replace that with something built specifically for {{company}}'s workflow.

Happy to show you the difference — just reply.`
  },
  {
    name: 'Generic Value - ROI Focus',
    step_number: 3,
    subject: 'The numbers behind automation for {{company}}',
    content: `{{first_name}},

Quick back-of-the-napkin maths: if your team spends even 2 hours a day on repetitive admin, that's roughly 500 hours a year. At an average staff cost, that's a significant chunk of revenue going to tasks a system could handle.

We build that system. You own it. No ongoing costs.

Worth exploring?`
  },
  {
    name: 'Generic Value - Integration',
    step_number: 3,
    subject: '{{first_name}} — connecting your existing tools',
    content: `{{first_name}},

One thing we hear a lot from businesses like {{company}} — "we already have tools, they just don't talk to each other."

That's exactly what we fix. We build custom middleware that connects your existing systems so data flows automatically. No rip-and-replace, just smarter integration.

Interested?`
  },
  {
    name: 'Generic Value - Security Angle',
    step_number: 3,
    subject: '{{first_name}} — keeping {{company}}\'s data in-house',
    content: `{{first_name}},

With data privacy becoming a bigger concern every year, more businesses are moving away from third-party SaaS that stores their data on external servers.

Everything we build runs on your own infrastructure. Your client data, your servers, your control.

If that matters to {{company}}, let me know and I'll walk you through how it works.`
  },
  {
    name: 'Generic Value - Scalability',
    step_number: 3,
    subject: 'Scaling {{company}} without scaling headcount',
    content: `{{first_name}},

The businesses growing fastest in {{location}} right now aren't necessarily hiring more people — they're automating the work that doesn't need a human touch.

We help with that. Custom systems for lead management, client onboarding, invoicing, reporting — whatever's eating up your team's time.

Reply if you'd like a quick overview.`
  },
  // ─── STEP 4: SOFT CLOSE ────────────────────────────────────────────
  {
    name: 'Generic Soft Close - Last Check',
    step_number: 4,
    subject: '{{first_name}} — last one from me',
    content: `{{first_name}},

I don't want to be a nuisance, so this will be my last email on this.

If automating parts of {{company}}'s operations ever becomes a priority, my inbox is always open. We build custom systems, you own them outright, and there are no ongoing fees.

Wishing you and the team all the best.`
  },
  {
    name: 'Generic Soft Close - Open Door',
    step_number: 4,
    subject: 'No worries, {{first_name}}',
    content: `{{first_name}},

Completely understand if this isn't the right time. I'll step back — but if things change down the line and {{company}} ever needs custom automation or development work, feel free to reach out.

All the best.`
  },
  {
    name: 'Generic Soft Close - Quick Summary',
    step_number: 4,
    subject: '{{first_name}} — signing off',
    content: `{{first_name}},

Just a quick recap in case you want to revisit later:

- We build custom automation systems for businesses like {{company}}
- You own the system — no monthly fees or vendor lock-in
- Everything runs on your infrastructure — your data stays yours

If any of that becomes relevant, you know where to find me. Take care.`
  },
  {
    name: 'Generic Soft Close - Referral Ask',
    step_number: 4,
    subject: 'One last thought, {{first_name}}',
    content: `{{first_name}},

If automation isn't on the cards for {{company}} right now, totally fair. But if you know anyone in {{location}} who might benefit from custom-built business systems, I'd appreciate an introduction.

Either way, thanks for your time. All the best.`
  },
  {
    name: 'Generic Soft Close - Future Offer',
    step_number: 4,
    subject: '{{first_name}} — parking this for now',
    content: `{{first_name}},

I'll leave this here. If {{company}} ever hits a point where manual processes are slowing things down, we can usually turn things around pretty quickly.

No pressure, no follow-up. Just reply whenever the time is right.`
  },
  // ─── STEP 5: BREAKUP / FAREWELL ────────────────────────────────────
  {
    name: 'Generic Farewell - Clean Break',
    step_number: 5,
    subject: '{{first_name}} — removing you from my list',
    content: `{{first_name}},

I'll take the hint and stop reaching out. If anything changes and you want to explore automation for {{company}}, just reply to any of my previous emails.

Wishing you a great rest of the quarter.`
  },
  {
    name: 'Generic Farewell - Lighthearted',
    step_number: 5,
    subject: '{{first_name}} — I can take a hint',
    content: `{{first_name}},

I get it — your inbox is probably overflowing. I'll step back.

But if {{company}} ever needs custom automation, CRM systems, or anything built specifically for your workflow — I'm one reply away.

Cheers.`
  },
  {
    name: 'Generic Farewell - Value Recap',
    step_number: 5,
    subject: 'Last note from me, {{first_name}}',
    content: `{{first_name}},

This is my last email. Here's the short version of what we do:

We build custom systems that automate repetitive business tasks. You own the software outright — no subscriptions, no seat fees. Everything runs on your servers.

If that ever sounds useful for {{company}}, just reply. Take care.`
  },
  {
    name: 'Generic Farewell - Seasonal',
    step_number: 5,
    subject: '{{first_name}} — all the best',
    content: `{{first_name}},

I'll close out this thread. If there's ever a time when {{company}} is looking to streamline operations or build something custom, my door's open.

Until then, hope business is going well in {{location}}. All the best.`
  },
  {
    name: 'Generic Farewell - Ultra Short',
    step_number: 5,
    subject: 'Closing the loop',
    content: `{{first_name}},

Stepping back on this. If you ever want to chat about automation for {{company}}, just reply here.

All the best.`
  }
];

async function insertTemplates() {
  console.log(`Inserting ${templates.length} new templates...`);
  
  for (const template of templates) {
    const { data, error } = await supabase
      .from('templates')
      .insert(template)
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
