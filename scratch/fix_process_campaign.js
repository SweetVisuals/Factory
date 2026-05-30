const fs = require('fs');
const filePath = 'c:\\Users\\Shadow\\Desktop\\Openclaw Factory\\companies\\Relay\\supabase\\functions\\process-campaign\\index.ts';

let content = fs.readFileSync(filePath, 'utf-8');

// Normalize line endings for reliable matching
const originalHasCRLF = content.includes('\r\n');
if (originalHasCRLF) {
  content = content.replace(/\r\n/g, '\n');
  console.log('[PREP] Normalized CRLF → LF for matching');
}

// ═══ FIX 1: Update AI personalization prompt to explicitly forbid sign-offs ═══
const oldRule = `"5. Tone: Professional, helpful, concise, and slightly informal (like a colleague).\\n" +\n"6. Output ONLY valid JSON: { \\\\"subject\\\\": \\\\"Customized subject line\\\\", \\\\"body\\\\": \\\\"Finished email body without signature\\\\" }";`;

const newRule = `"5. Tone: Professional, helpful, concise, and slightly informal (like a colleague).\\n" +\n"6. ABSOLUTELY DO NOT include any sign-off, closing, or signature in the body. No 'Best,', 'Regards,', 'Cheers,', 'Thanks,', 'Sincerely,', or ANY name at the end. The system auto-appends the correct sender signature. Including one will cause a DUPLICATE and a WRONG NAME.\\n" +\n"7. Output ONLY valid JSON: { \\\\"subject\\\\": \\\\"Customized subject line\\\\", \\\\"body\\\\": \\\\"Finished email body without any sign-off or signature\\\\" }";`;

if (content.includes(oldRule)) {
  content = content.replace(oldRule, newRule);
  console.log('[FIX 1] ✅ Updated AI prompt to forbid sign-offs');
} else {
  console.log('[FIX 1] ❌ Could not find AI prompt target');
  // Debug: show what's around rule 5
  const idx = content.indexOf('"5. Tone: Professional');
  if (idx !== -1) {
    const snippet = content.substring(idx, idx + 300);
    console.log('[FIX 1] Nearby content:', JSON.stringify(snippet));
  }
}

// ═══ FIX 2: Replace the broken sign-off logic with strip-then-append ═══
const startMarker = '// ═══ CONSOLIDATED SIGN-OFF';
const endMarker = '// --- COMPREHENSIVE PLACEHOLDER';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  // Get the indentation
  const lineStart = content.lastIndexOf('\n', startIdx) + 1;
  const indent = content.substring(lineStart, startIdx);
  
  const newSignOffBlock = `// ═══ FIX: ALWAYS STRIP EXISTING SIGN-OFFS, THEN APPEND CORRECT ONE ═══
${indent}// This prevents: (1) wrong sender name in sign-off (e.g. Byron sending as Ethan)
${indent}//                (2) duplicate sign-offs (AI adds one + system adds another)
${indent}let strippedBody = bodyContent;

${indent}// Strip sign-offs at the end: "Best,\\nSomeName\\nCompany" etc.
${indent}const signOffStrip = /\\n*\\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care),?\\s*\\n[\\s\\S]{0,200}$/i;
${indent}strippedBody = strippedBody.replace(signOffStrip, '').trimEnd();

${indent}// Also strip {ender} placeholders and everything after them
${indent}strippedBody = strippedBody
${indent}    .replace(/\\n*\\s*\\{\\{?ender\\}\\}?[\\s\\S]*$/i, '')
${indent}    .replace(/\\n*\\s*\\[Sender Name\\][\\s\\S]*$/i, '')
${indent}    .trimEnd();

${indent}// Build the correct sign-off using the ACTUAL sending account
${indent}const cleanSignature = account.signature ? account.signature.trim() : '';
${indent}let personalContent: string;

${indent}if (cleanSignature) {
${indent}    personalContent = \`\${strippedBody}\\n\\n\${cleanSignature}\`;
${indent}} else {
${indent}    const senderFullName = account.name || senderFirstName;
${indent}    personalContent = \`\${strippedBody}\\n\\n\${randomEnder}\\n\${senderFullName}\\n\${senderCompany}\`.trimEnd();
${indent}}

${indent}`;

  content = content.substring(0, lineStart) + indent + newSignOffBlock + content.substring(endIdx);
  console.log('[FIX 2] ✅ Replaced sign-off logic with strip-then-append');
} else {
  console.log('[FIX 2] ❌ Could not find CONSOLIDATED SIGN-OFF markers');
  console.log('  startIdx:', startIdx, 'endIdx:', endIdx);
}

// Restore CRLF if original had it
if (originalHasCRLF) {
  content = content.replace(/\n/g, '\r\n');
  console.log('[PREP] Restored LF → CRLF');
}

// Write the result
fs.writeFileSync(filePath, content, 'utf-8');
console.log('\n✅ All fixes written to', filePath);
