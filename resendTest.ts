import { Resend } from 'resend';
import 'dotenv/config';

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error('RESEND_API_KEY is not set');
}

const resend = new Resend(apiKey);

try {
  const result = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'nareshdewasi021@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>third email</strong>!</p>',
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  console.log('Email sent successfully:', result.data?.id);
} catch (error) {
  console.error('Failed to send email:', error);
  process.exitCode = 1;
}
