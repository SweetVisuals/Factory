const fs = require('fs');

function fixFile(path, oldText, newText) {
  let content = fs.readFileSync(path, 'utf8');
  const originalHasCRLF = content.includes('\r\n');
  if (originalHasCRLF) content = content.replace(/\r\n/g, '\n');
  
  const normalizedOldText = oldText.replace(/\r\n/g, '\n');
  
  if (content.includes(normalizedOldText)) {
    content = content.replace(normalizedOldText, newText);
    if (originalHasCRLF) content = content.replace(/\n/g, '\r\n');
    fs.writeFileSync(path, content, 'utf8');
    console.log(`✅ Fixed ${path}`);
  } else {
    console.log(`❌ Could not find target in ${path}`);
  }
}

fixFile('c:/Users/Shadow/Desktop/Openclaw Factory/relay_sales_strategist_agent.md',
`- **SIMILARITY CHECK**: If the niche or target market is already covered by an existing campaign, you MUST pivot to a new, broader target. Do NOT repeat yourself.`,
`- **SIMILARITY CHECK**: If the niche or target market is already covered by an existing campaign, you MUST pivot to a new, broader target. Do NOT repeat yourself.
- **GLOBAL DEDUPLICATION**: Avoid targeting leads that are already part of another active campaign. Coordinate with the **Validator** and **Emailer** to ensure a broad, non-overlapping reach.`);
