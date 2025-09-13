import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { assertEnv } from './env.js';
import logger from './logger.js';

assertEnv(['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'FROM_EMAIL']);

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function sendEmail({ to, subject, html, text }) {
  const displayName = 'Rav Growth';
  const fromAddress = process.env.FROM_EMAIL;
  logger.info('sendEmail', { to, subject });

  await ses.send(
    new SendEmailCommand({
      Source: `"${displayName}" <${fromAddress}>`,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html || '' },
          Text: { Data: text || '' },
        },
      },
    })
  );
}

