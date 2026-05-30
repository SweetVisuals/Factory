const fs = require('fs');
const filePath = 'c:\\Users\\Shadow\\Desktop\\Openclaw Factory\\companies\\Relay\\supabase\\functions\\process-campaign\\index.ts';

let content = fs.readFileSync(filePath, 'utf-8');

// Find the exact line containing rule 6
const searchStr = '6. Output ONLY valid JSON:';
const idx = content.indexOf(searchStr);

if (idx === -1) {
  console.log('Cannot find target');
  process.exit(1);
}

// Find the start of the line (after the quote)
const lineStart = content.lastIndexOf('"', idx);
// Find the end of this statement (the semicolon after the closing quote)
const semiIdx = content.indexOf('";', idx);
const lineEnd = semiIdx + 2; // include the ";

const oldLine = content.substring(lineStart, lineEnd);
console.log('FOUND OLD LINE:', oldLine);

const newLine = '"6. ABSOLUTELY DO NOT include any sign-off, closing, or signature in the body. No Best, Regards, Cheers, Thanks, Sincerely, or ANY name at the end. The system auto-appends the correct sender signature. Including one will cause a DUPLICATE and a WRONG NAME.\\n" +\r\n"7. Output ONLY valid JSON: { \\"subject\\": \\"Customized subject line\\", \\"body\\": \\"Finished email body without any sign-off or signature\\" }";';

content = content.substring(0, lineStart) + newLine + content.substring(lineEnd);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('✅ Updated AI prompt successfully');
