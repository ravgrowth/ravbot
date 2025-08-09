// ses.cjs

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// supports html + text
async function sendEmail({ to, subject, html, text, fromName }) {
  const displayName = fromName || 'Rav Growth'; // default pretty name
  const fromAddress = process.env.FROM_EMAIL || 'bot@ravgrowth.com'; // still sends from bot@

  await ses.sendEmail({
    Source: `"${displayName}" <${fromAddress}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html || '' },
        Text: { Data: text || '' }
      }
    }
  });
}

module.exports = { sendEmail };
