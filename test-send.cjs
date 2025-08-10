require('dotenv').config({ path: '.env.server' });
// or path: '.env.local' depending on which file has the AWS creds

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function main() {
  const params = {
    Source: '"Rav Growth" <bot@ravgrowth.com>',
    Destination: { ToAddresses: ['ta999003@gmail.com'] }, // change this
    Message: {
      Subject: { Data: 'SES Test - Rav Growth' },
      Body: {
        Html: { Data: '<p>Hello from Rav Growth</p>' },
        Text: { Data: 'Hello from Rav Growth' }
      }
    }
  };

  try {
    console.log('Sending test email...');
    const result = await ses.send(new SendEmailCommand(params));
    console.log('✅ Email sent!');
    console.log('Message ID:', result.MessageId);
    console.log('From header should be exactly: "Rav Growth" <bot@ravgrowth.com>');
  } catch (err) {
    console.error('❌ Send failed:', err);
  }
}

main();
