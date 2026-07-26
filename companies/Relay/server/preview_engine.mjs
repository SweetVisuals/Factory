import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const GEMINI_API_KEY = process.env["GEMINI_API_KEY"] || "sk-6733c8ac2b83402b8626e5e253824488";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

router.post('/preview', async (req, res) => {
  try {
    const { toneContent, businessOverview, industry, targetAudience } = req.body;

    const systemPrompt = `You are an expert B2B sales copywriter writing a personalized cold email. 
Your ONLY job is to write a highly compelling, personalized cold email using the Tone Guidelines and Business Context provided. 
Do NOT wrap the email in quotes. Do NOT include any intro or outro commentary like "Here is your email:". Just return the Subject and the Body.

Format exactly like this:
Subject: [Your compelling subject]

[The email body...]

${industry ? 'BUSINESS INDUSTRY:\n' + industry + '\n\n' : ''}
${targetAudience ? 'TARGET AUDIENCE:\n' + targetAudience + '\n\n' : ''}
${toneContent ? 'TONE GUIDELINES:\n' + toneContent + '\n\n' : ''}
${businessOverview ? 'BUSINESS CONTEXT:\n' + businessOverview.substring(0, 2000) + '\n\n' : ''}`;

    const userPrompt = `Please write a sample email to a prospect named 'John Doe' who is the CEO at 'Acme Corp'. They are in the e-commerce space and are struggling with manual data entry.`;

    const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Provider Error: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    const resultText = json.choices?.[0]?.message?.content || '';

    res.json({ success: true, email: resultText.trim() });
  } catch (error) {
    console.error('[AI Preview Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
