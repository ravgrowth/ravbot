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
  if ((process.env.DEBUG_EMAIL_CODES || '').toLowerCase() === 'true') {
    console.log('[DEBUG email]', { to, subject });
    return;
  }

  await ses.sendEmail({
    Source: `"Rav Growth" <${process.env.FROM_EMAIL}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html || '' },
        Text: { Data: text || '' },
      },
    },
  }).promise();

  console.log('[SES] sent →', to);
}

module.exports = { sendEmail };
