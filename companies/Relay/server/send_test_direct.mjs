import nodemailer from 'nodemailer';

async function testEmail() {
    // 2. Define exactly what the AI would generate
    let bodyContent = `Hi Acme Innovations,\\n\\nEven without much public detail on Immersive Brands, I imagine you're still dealing with the usual manual grind—consolidating reports, chasing data.\\n\\nWe build custom automation that eliminates that entirely. Reply if you want to fix it.`;
    
    // Simulate what the edge function does to fix literal newlines
    if (bodyContent) {
        bodyContent = bodyContent.replace(/\\n/g, '\n');
    }

    // 3. Edge function formatting logic
    let strippedBody = bodyContent;
    const signOffStrip = /\n*\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*(?:\n[\s\S]{0,200}|\s*$)/i;
    strippedBody = strippedBody.replace(signOffStrip, '').trimEnd();
    strippedBody = strippedBody.replace(/\s*(Best|Kind regards|Regards|Warm regards|Cheers|Thanks|Sincerely|Thank you|All the best|Take care|Looking forward),?\s*$/i, '').trimEnd();
    
    strippedBody = strippedBody
        .replace(/\n*\s*\{\{?ender\}\}?[\s\S]*$/i, '')
        .replace(/\n*\s*\[Sender Name\][\s\S]*$/i, '')
        .trimEnd();

    const cleanSignature = '';
    let randomOptOut = "Not the right time? Just let me know and I'll update my records."; // Step 1 opt-out
    
    const enders = ['Best,', 'Kind regards,', 'Regards,', 'Warm regards,', 'Cheers,'];
    const randomEnder = enders[0]; // 'Best,'

    let personalContent;
    if (cleanSignature) {
        personalContent = `${strippedBody}\n\n${cleanSignature}${randomOptOut ? '\n\n' + randomOptOut : ''}`;
    } else {
        const senderFullName = 'Liam';
        const senderCompany = 'Relay Solutions';
        personalContent = `${strippedBody}\n\n${randomEnder}\n${senderFullName}\n${senderCompany}${randomOptOut ? '\n\n' + randomOptOut : ''}`.trimEnd();
    }

    let finalBody = personalContent;
    const finalHtml = finalBody.replace(/\r?\n/g, '<br/>');

    console.log("=== FINAL PLAIN TEXT TO BE SENT ===");
    console.log(finalBody);
    console.log("===================================");

    // 4. Send via Nodemailer
    const transporter = nodemailer.createTransport({
        host: 'relaysolutions.net',
        port: 465,
        secure: true,
        auth: { user: 'liam@relaysolutions.net', pass: 'Longlonglong1!' }
    });

    try {
        console.log("Sending email to acedkmgmt@gmail.com...");
        await transporter.sendMail({
            from: '"Liam" <liam@relaysolutions.net>',
            to: 'acedkmgmt@gmail.com',
            subject: 'Re: Fixing your outreach formatting',
            text: finalBody,
            html: finalHtml
        });
        console.log("✅ Email sent successfully!");
    } catch (err) {
        console.error("❌ Send failed:", err);
    }
}

testEmail();
