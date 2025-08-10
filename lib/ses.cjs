const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// supports html + text
async function sendEmail({ to, subject, html, text }) {
  const displayName = 'Rav Growth';
  const fromAddress = 'bot@ravgrowth.com';
  console.log('sendEmail:', { to, subject, displayName, fromAddress });

  await ses.sendEmail({
    Source: '"Rav Growth" <bot@ravgrowth.com>',
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
