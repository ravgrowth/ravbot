const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { assertEnv } = require('./env.cjs');
const logger = require('./logger.cjs');

assertEnv(['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'FROM_EMAIL']);

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function sendEmail({ to, subject, html, text }) {
  const displayName = 'Rav Growth';
  const fromAddress = process.env.FROM_EMAIL;
  logger.info('sendEmail', { to, subject });

  await ses.send(new SendEmailCommand({
    Source: `"${displayName}" <${fromAddress}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html || '' },
        Text: { Data: text || '' }
      }
    }
  }));
}

module.exports = { sendEmail };
