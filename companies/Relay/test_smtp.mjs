import nodemailer from 'nodemailer';

async function main() {
    const transporter = nodemailer.createTransport({
        host: 'mrmedicevents.org',
        port: 465,
        secure: true,
        auth: {
            user: 'info@mrmedicevents.org',
            pass: 'Longlonglong1!'
        },
        debug: true,
        logger: true
    });

    try {
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Success! SMTP connection is verified.');
    } catch (error) {
        console.error('SMTP Connection Failed:', error);
    }
}
main();
