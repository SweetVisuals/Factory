const fs = require('fs');

const md = fs.readFileSync('cold-email-sequences-125.md', 'utf8');

let updatedMd = md
  .replace(/on the tools/g, 'busy with clients')
  .replace(/doing the actual work/g, 'serving clients')
  .replace(/missed jobs/g, 'lost clients')
  .replace(/lost jobs/g, 'lost clients')
  .replace(/potential jobs/g, 'potential clients')
  .replace(/lost work/g, 'lost revenue')
  .replace(/the actual work/g, 'their core work')
  .replace(/a missed job/g, 'a lost client')
  .replace(/several jobs/g, 'several clients');

fs.writeFileSync('cold-email-sequences-125.md', updatedMd);

const lines = updatedMd.split('\n');
const steps = [];
let currentStep = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('## STEP')) {
    currentStep++;
    steps[currentStep] = [];
  } else if (line.match(/^\d+\.\s+Subject:/)) {
    const subject = line.replace(/^\d+\.\s+Subject:\s*/, '').trim();
    let body = '';
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== '' && !lines[j].match(/^\d+\.\s+Subject:/) && !lines[j].startsWith('## STEP')) {
      body += lines[j] + '\n';
      j++;
    }
    steps[currentStep].push({ subject, body: body.trim() });
  }
}

const tsContent = `// Auto-generated from cold-email-sequences-125.md
export const emailSequences = ${JSON.stringify(steps, null, 2)};

const signOffs = ['Regards', 'Best', 'Thanks', 'Cheers', 'Best regards'];

export function getRandomSequence() {
  return emailSequences.map(step => step[Math.floor(Math.random() * step.length)]);
}

export function generateEmail(template: { subject: string, body: string }, name: string, industry: string) {
  const signOff = signOffs[Math.floor(Math.random() * signOffs.length)];
  const body = template.body
    .replace(/\\[Name\\]/g, name || 'there')
    .replace(/\\[industry\\]/g, industry || 'your industry')
    + '\\n\\n' + signOff + ',\\nNicolas Theato';
    
  return {
    subject: template.subject,
    body
  };
}
`;

fs.writeFileSync('companies/Relay/src/lib/utils/emailSequences.ts', tsContent);