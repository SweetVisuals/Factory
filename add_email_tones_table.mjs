import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');
  
  try {
    console.log("Creating email_tones table...");
    await sql`
      CREATE TABLE IF NOT EXISTS email_tones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        content_md text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `;
    console.log("email_tones table created successfully!");
    
    // Check if table is empty and seed some default tone files
    const countResult = await sql`SELECT count(*) FROM email_tones`;
    const count = parseInt(countResult[0].count);
    
    if (count === 0) {
      console.log("Seeding default email tone files...");
      
      const casualToneMd = `# Conversational Cold Outreach Tone

## Core Principle
Write exactly like a human sends a brief message to a colleague. Avoid marketing jargon, formal introductions, and excessive politeness that triggers "AI warnings".

## DO's
- **Keep it under 3-4 sentences.** The shorter, the better.
- **Use casual subject lines** in lowercase (e.g., \`quick question\`, \`design feed\`).
- **Use raw text linebreaks** and one simple call to action.
- **Reference a specific observation** about their company early.

## NOT to DO's
- **DO NOT** use AI-typical words like "I hope this email finds you well", "Furthermore", "In conclusion", "Unlock potential".
- **DO NOT** pitch immediately. Build rapport first.
- **DO NOT** sign off with "Sincerely" or "Respectfully". Use "Best" or just your name.

## Example Email
\`\`\`
Subject: quick question

Hey {first_name},

Saw you recently launched the new client portal on {company}—looks really clean. 

Who handles your user interface design? We design for SaaS teams and had a few ideas to share.

Worth a brief chat?

Best,
Ethan
\`\`\`
`;

      const followUpToneMd = `# Value-Driven Follow-Up Tone

## Core Principle
Follow-up without being annoying or sounding like an automated sequence. Add value or check-in casually.

## DO's
- **Reply in the same thread** so they see the context.
- **Keep it to 2 sentences.**
- **Provide a helpful asset** or reference a new piece of work.

## NOT to DO's
- **DO NOT** say "Just bumping this" or "Just following up". It screams automation.
- **DO NOT** use long paragraphs.

## Example Email
\`\`\`
Hey {first_name},

Thought you might find this short case study interesting—we helped a similar automation firm boost conversion by 30%. 

Let me know if you want the wireframes we used.

Best,
Ethan
\`\`\`
`;

      await sql`
        INSERT INTO email_tones (name, slug, content_md) VALUES 
        ('Casual Conversational', 'casual-conversational', ${casualToneMd}),
        ('Value-Driven Follow-Up', 'value-driven-follow-up', ${followUpToneMd})
      `;
      console.log("Seeded successfully!");
    }
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    await sql.end();
  }
}

main();
