import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

const email = 'ptnmgmt@gmail.com';
const pass = 'bcoqykkilmjzkhuq';

async function testImap() {
  console.log('Testing IMAP...');
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: email,
      pass: pass
    },
    logger: false
  });
  
  try {
    await client.connect();
    console.log('✅ IMAP connection successful!');
    await client.logout();
  } catch (err) {
    console.error('❌ IMAP connection failed:');
    console.error(err);
  }
}

async function testSmtp465() {
  console.log('Testing SMTP 465...');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: pass
    }
  });
  
  try {
    await transporter.verify();
    console.log('✅ SMTP 465 connection successful!');
  } catch (err) {
    console.error('❌ SMTP 465 connection failed:');
    console.error(err);
  }
}

async function testSmtp587() {
  console.log('Testing SMTP 587...');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS via STARTTLS
    auth: {
      user: email,
      pass: pass
    }
  });
  
  try {
    await transporter.verify();
    console.log('✅ SMTP 587 connection successful!');
  } catch (err) {
    console.error('❌ SMTP 587 connection failed:');
    console.error(err);
  }
}

async function run() {
  await testImap();
  await testSmtp465();
  await testSmtp587();
}

run();
