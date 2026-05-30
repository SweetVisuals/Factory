import dotenv from 'dotenv';
dotenv.config();



const leadFirstName = 'Jordan';
const leadReply = null;
const ourLastEmail = null;
const schedule = {
    templates: {
        subject: 'Quick question about {{company}}',
        content: 'Hi {{first_name}},\n\nMany food truck owners tell us they struggle with inconsistent revenue and operational headaches. <company> helps streamline everything from location planning to customer loyalty, so you can focus on what you do best.\n\nWould it make sense to share a few specific ideas that have worked for similar businesses?\n\n{ender}\n<company>\n\n[Sender Name]\n[Email]\n[Phone]'
    }
};
const lead = {
    company: 'Vesuvio',
    summary: 'I saw your copyright notice and was curious about Vesuvio.'
};

const systemPrompt = "You are personalizing a B2B cold email for a specific lead. Your goal is to make it feel human and relevant, WHILE STRICTLY PRESERVING THE ORIGINAL TEMPLATE'S CORE MESSAGE, STRUCTURE, AND VALUE PROPOSITION.\n" +
    "Personality: Friendly, genuinely curious, slightly witty. You sound like a helpful colleague, not a marketing bot.\n\n" +
    "Instructions:\n" +
    "1. Greeting: Use \"Hi " + leadFirstName + ",\" - NEVER use full name or last name.\n" +
    "2. Use the provided Notes to write a short, highly personalized opening sentence that connects to the lead's business naturally.\n" +
    "3. CRITICAL: After the opening sentence, you MUST transition smoothly into the Provided Template Body. Do NOT rewrite the core value proposition, offer, or questions from the template. Keep the template's structure intact.\n" +
    "4. NEVER mention the lead's job title or role anywhere.\n" +
    "5. Tone: Warm, concise, genuinely helpful. Like messaging someone you want to work with. Rephrase any clunky transitions.\n" +
    "6. Output ONLY valid JSON: { \"subject\": \"Your suggested customized subject\", \"body\": \"The full personalized email body text. NO SIGN-OFF.\" }\n";

const userPrompt = "Template Subject: \"" + schedule.templates.subject + "\"\n" +
    "Template Body: \"" + schedule.templates.content + "\"\n" +
    "Lead: " + leadFirstName + " at " + (lead.company || '') + "\n" +
    "Notes: \"" + (lead.summary || '') + "\"" +
    "\n\nPersonalize the Template Subject and Template Body using the Notes for this lead. " +
    "Customize the subject to be relevant to their business if the Notes provide good context, otherwise lightly tweak the Template Subject." +
    " Do NOT mention their role/title. First name only. Keep the original offer/message from the Template Body intact. Let's keep it short and genuine.";

import { fetchAIChatCompletion } from './server/ai-client.mjs';

async function testPrompt() {
    console.log("Testing DeepSeek AI Generation...");
    try {
        const data = await fetchAIChatCompletion({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        }, console.log);

        console.log("AI Response: ", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testPrompt();
