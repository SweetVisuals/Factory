import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2';

const DEEPSEEK_API_KEY = 'sk-0d0013ae961e47ba9afae12205877d98';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://fzcrjogrnujrfxafxbkh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const OPENROUTER_KEYS = [
  Deno.env.get('OPENROUTER_API_KEY'),
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY",
  "process.env.OPENROUTER_API_KEY"
].filter(Boolean) as string[];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignName, niche, company, contactNumber, primaryEmail, count = 5 } = await req.json()

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: deepseekOption } = await supabaseAdmin
        .from('api_keys')
        .select('key_value')
        .eq('service', 'disable_deepseek')
        .maybeSingle();
    const disableDeepseek = deepseekOption?.key_value === 'true';

    console.log(`Generating ${count} sequences for ${company} (${niche})`);

    // Define the archetypes for each step so each email has a very specific, deliberate angle
    const archetypes = [
      {
        name: "The Pattern Interrupt",
        guidance: `This is the very first cold email. The #1 job is to point out specific improvements for their business using the provided [[notes]].
- Open by acknowledging their business: "I noticed {{company}} serves {{location}} with a range of {{niche}} services." (or similar).
- State a problem: "Leads often slip through the cracks when your site doesn't show what you can really do."
- Do NOT ask them what their current site does or what the biggest gap is.
- Instead, directly point out where they could improve by seamlessly integrating the [[notes]] placeholder (which contains specific areas of improvement we found).
- Example: "When we looked at your site, we noticed these things could be improved: [[notes]]". Do not write the actual improvements, just use the [[notes]] placeholder exactly as shown so our system can inject them.
- Keep the tone helpful, direct, and observational, not like a pitch.
- Under 60 words total (excluding the notes content).`
      },
      {
        name: "The Value Add",
        guidance: `This is a follow-up email (Step 2). They know who you are — now prove you're worth their time.
- Lead with a useful insight, stat, or observation relevant to the {{industry}} niche that they might not know.
- Frame your offer as a natural extension of that insight, not as a pitch.
- ONE clear call-to-action: either a question or "worth a quick 10 minutes?"
- Tone: confident but not pushy. Like sharing something useful with a contact.`
      },
      {
        name: "The Social Proof Nudge",
        guidance: `This is a mid-sequence email (Step 3). They've seen you twice — now build credibility without bragging.
- Reference a concrete result, outcome, or scenario relevant to someone in the {{industry}} space (keep it generic unless notes provide detail).
- Make it feel like you're telling a quick story, not showing off.
- End with a low-friction CTA. "Curious if this is relevant to you?" or similar.`
      },
      {
        name: "The Soft Touch",
        guidance: `This is a later-sequence email (Step 4). Keep it super short and human.
- Acknowledge time has passed without being needy or apologetic.
- One sentence framing, one question. That's it.
- Tone: relaxed, almost casual. Like bumping into them in a hallway.
- Under 40 words total (excluding greeting and signature placeholders).`
      },
      {
        name: "The Breakup",
        guidance: `This is the final email in the sequence. Use the "breakup" framework — polite closure that often drives responses.
- Tell them this is your last email. No hard feelings.
- Leave the door open: "If timing changes, I'm easy to find."
- Do NOT be passive-aggressive or guilt-trippy.
- Under 45 words (excluding greeting + signature placeholders).`
      }
    ];

    // Pick the archetypes we need based on count
    const selectedArchetypes = archetypes.slice(0, Math.min(count, archetypes.length));
    // If count > archetypes.length, pad with Value Add variations
    while (selectedArchetypes.length < count) {
      selectedArchetypes.push({
        name: `Follow-Up ${selectedArchetypes.length}`,
        guidance: `A mid-sequence follow-up. Keep it fresh — reference something different from earlier emails. Short, human, one CTA.`
      });
    }

    const archetypeInstructions = selectedArchetypes.map((a, i) =>
      `Template ${i + 1} — "${a.name}":\n${a.guidance}`
    ).join('\n\n');

    const systemPrompt = `You are an elite B2B cold email copywriter. You write like a real human, not a marketing department.
Every email you write must feel like it came from someone who actually understands the recipient's world — not someone blasting a list.

The sender's details:
Company: ${company}
Niche: ${niche}
Contact: ${contactNumber}
Email: ${primaryEmail}

ABSOLUTE RULES (violating any of these is a failure):
1. GREETING: Always "Hi {{first_name}}," — NEVER full name, NEVER last name.
2. NEVER mention the lead's job title or role. No {{title}}.
3. BANNED phrases — never use these under any circumstances: "sounds interesting", "I hope this finds you well", "I wanted to reach out", "touch base", "synergy", "leverage", "unlock potential", "game-changer", "I came across your website", "I noticed you", "just checking in", "circling back".
4. Every template MUST end with EXACTLY these placeholders on separate lines:
   {{ender}}
   {{sender_first_name}}
   {{sender_phone}}
   {{sender_email}}
5. Available placeholders (use sparingly and naturally): {{first_name}}, {{company}}, {{industry}}, {{location}}, [[notes]]
6. NO sign-off words in the body content itself (the {{ender}} placeholder handles it).
7. Each email must feel completely different in angle, tone, and structure from the others.
8. LENGTH LIMITS: The core email body text MUST NOT exceed 60 words and 350 characters.
9. PROTECTED ZONES: The introduction greeting (e.g., "Hi {{first_name}},") and the required signature placeholders ({{ender}}, {{sender_first_name}}, etc.) DO NOT count towards your word or character limit. DO NOT improperly cut off sentences, greetings, or sign-offs just to meet the limit. Write complete, concise thoughts.
10. EXAMPLE OF GOOD COPY (Short, direct, well-structured):
"Hi {{first_name}},

Noticed {{company}} is scaling {{industry}} operations. Many teams struggle with bottlenecks during expansion. We fixed this for a similar firm by streamlining their workflow, saving them 20 hours a week.

Worth a quick chat to see if we can do the same for you?

{{ender}}
{{sender_first_name}}
{{sender_phone}}
{{sender_email}}"

Generate exactly ${count} templates, each following its specific archetype below:

${archetypeInstructions}

Return ONLY a valid JSON array. No markdown, no extra text. Format:
[
  {
    "name": "Archetype name exactly as defined above",
    "subject": "Compelling, specific subject line — avoid generic subjects like 'Quick question' or 'Following up'",
    "content": "Full email body. Greeting included. Ends with the 4 required placeholder lines. No actual sign-off words."
  }
]
`;

    const userPrompt = `Generate exactly ${count} cold email templates for campaign "${campaignName}" in the "${niche}" niche.
Each template must strictly follow its assigned archetype from the system prompt.
No clichés. No "sounds interesting", "I hope this finds you well", or similar tired openers.
Each email must feel like it was written by a different person with a different angle.
Do NOT mention the lead's role or job title anywhere.`;

    let data;
    if (disableDeepseek) {
      console.log("DeepSeek is disabled. Trying OpenRouter key cycling for sequence generation...");
      let success = false;
      for (let k = 0; k < OPENROUTER_KEYS.length; k++) {
          const apiKey = OPENROUTER_KEYS[k];
          try {
              const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${apiKey}`,
                      'HTTP-Referer': 'https://github.com/Openclaw-Factory',
                      'X-Title': 'ColdSpark'
                  },
                  body: JSON.stringify({
                      model: 'openrouter/owl-alpha',
                      messages: [
                          { role: 'system', content: systemPrompt },
                          { role: 'user', content: userPrompt }
                      ],
                      temperature: 0.95
                  })
              });
              if (res.ok) {
                  const resData = await res.json();
                  if (resData && !resData.error && resData.choices?.[0]) {
                      data = resData;
                      success = true;
                      break;
                  } else {
                      console.error(`OpenRouter Key ${k + 1} API Error:`, resData?.error?.message || JSON.stringify(resData?.error));
                  }
              } else {
                  console.error(`OpenRouter Key ${k + 1} Status Error:`, res.status, await res.text());
              }
          } catch (err) {
              console.error(`OpenRouter Key ${k + 1} Network/Timeout Error:`, err);
          }
      }
      if (!success) {
          throw new Error("All OpenRouter API keys failed or exhausted for sequence generation.");
      }
    } else {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.95 // High temperature for creative variation — each regeneration should feel genuinely different
        })
      });
      data = await response.json();
    }
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('No response from AI provider');
    }

    const content = data.choices[0].message.content;
    
    // Clean up content to ensure it's valid JSON
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```/, '').replace(/```$/, '');
    }

    let sequences;
    try {
        sequences = JSON.parse(cleanContent);
    } catch (e) {
        console.error("Failed to parse JSON", cleanContent);
        throw new Error("AI returned invalid JSON format");
    }

    return new Response(JSON.stringify({ success: true, data: sequences }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Returning 200 with success: false to handle gracefully in frontend
    })
  }
})
