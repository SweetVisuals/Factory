const bodyContent = "Hi Acme Innovations,\\n\\nEven without much public detail on Immersive Brands, I imagine you're still dealing with the usual manual grind—consolidating reports, chasing data. We build custom automation that eliminates that entirely. Reply if you want to fix it.\\n\\nWarm regards,\\nReed\\n\\nNot the right time? Just let me know and I'll update my records.";

// What the Edge Function does
let b = bodyContent.replace(/\\n/g, '\n');

console.log('--- ORIGINAL ---');
console.log(bodyContent);

console.log('--- REPLACED ---');
console.log(b);

let strippedBody = b;

// Strip sign-offs at the end
const signOffStrip = /\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*(?:\n[\s\S]{0,200}|\s*$)/i;
strippedBody = strippedBody.replace(signOffStrip, '').trimEnd();
strippedBody = strippedBody.replace(/\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*$/i, '').trimEnd();

console.log('--- STRIPPED ---');
console.log(strippedBody);

let personalContent = `${strippedBody}\n\nWarm regards,\nReed\n\nNot the right time?`;
console.log('--- PERSONAL CONTENT ---');
console.log(personalContent);
