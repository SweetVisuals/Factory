let O = `there,

Handling confidential client files over email is risky and feels unprofessional. We build custom-branded, secure client portals that run on your own infrastructure.

If that fixes a headache, just reply.

Jordan
Relay Solutions`;

const ke = /\n+\s*[A-Z][a-z]+\s*\n\s*Relay Solutions[^]*$/i;
O = O.replace(ke, "").trimEnd();
console.log("After Regex 2:");
console.log(O);

// Also let's fix the "there," greeting!
let text = "there,\n\nBlah";
text = text.replace(/^(hi\s+)?(there|friend|name|\[name\]|first name),/i, "Hi there,");
console.log("After Greeting Fix:");
console.log(text);
