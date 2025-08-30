// server.cjs

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.server') });
const { assertEnv } = require('./lib/env.cjs');
const logger = require('./lib/logger.cjs');
const { cancelSubscription } = require('./lib/subscriptions.cjs');
assertEnv([
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'FROM_EMAIL'
]);

const express = require('express');
const app = express();
app.use(express.json());

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// optional - use AWS SES v3
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

function niceEmail({ title, prehead, bodyHtml, ctaText, ctaHref, footerNote }) {
  const pre = prehead || '';
  return `
<!doctype html>
<html>
  <head>
    <meta charSet="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <title>${title}</title>
    <style>
      @media (max-width:600px){ .box{padding:16px !important} .h1{font-size:20px !important} }
    </style>
  </head>
  <body style="margin:0;background:#0b0f17;color:#e6eefc;font-family:Inter,Segoe UI,Arial">
    <div style="display:none;opacity:0;max-height:0;overflow:hidden">${pre}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f17">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px">
            <tr>
              <td class="box" style="background:#111828;border:1px solid #1f2937;border-radius:16px;padding:24px">
                <h1 class="h1" style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#f8fafc">${title}</h1>
                <div style="font-size:14px;line-height:1.6;color:#cbd5e1">${bodyHtml}</div>
                ${ctaHref ? `
                <div style="margin-top:16px">
                  <a href="${ctaHref}"
                     style="display:inline-block;padding:10px 16px;border-radius:999px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600">
                     ${ctaText || 'Open'}
                  </a>
                </div>` : ``}
                ${footerNote ? `
                <div style="margin-top:16px;font-size:12px;color:#94a3b8">${footerNote}</div>` : ``}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px;text-align:center;color:#64748b;font-size:12px">
                Sent by Rav Growth • This is a one time security email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function six() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendCodeEmail(to, code) {
  const html = niceEmail({
    title: 'Your veriifcation code',
    prehead: 'Use this code in 10 minutes',
    bodyHtml: `<p>Your code is <b style="font-size:16px">${code}</b>. It ends in 10 minutes.</p>`,
    ctaText: 'Enter code',
    ctaHref: `${process.env.APP_ORIGIN || 'http://localhost:5173'}/change-email`,
    footerNote: 'If you did not ask for this, you can ignore this email.'
  });
  const text = `Your code is ${code}. It ends in 10 minutes.`;
  await ses.send(new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: 'Your verification code' },
      Body: { Html: { Data: html }, Text: { Data: text } }
    },
    Source: process.env.FROM_EMAIL,
    ReplyToAddresses: [process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL]
  }));
}

async function sendInfoEmail(to, subject, htmlBody, textBody) {
  const html = niceEmail({
    title: subject,
    prehead: 'Account security notice',
    bodyHtml: htmlBody
  });
  await ses.send(new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html }, Text: { Data: textBody } }
    },
    Source: process.env.FROM_EMAIL,
    ReplyToAddresses: [process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL]
  }));
}

const DEBUG_EMAILS = process.env.NODE_ENV !== 'production' && !!(process.env.RAV_DEBUG_EMAIL || process.env.DEBUG_EMAILS);

// POST /api/sendEmailChangeCode
app.post('/api/sendEmailChangeCode', async (req, res) => {
  try {
    const { user_id, current_email, new_email } = req.body || {};
    if (!user_id || !current_email || !new_email) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (current_email.toLowerCase() === new_email.toLowerCase()) {
      return res.status(400).json({ error: 'New email must be different' });
    }

    // make code
    const code = six();
    const exp = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // save code row
    const { error: insErr } = await supabase
      .from('email_change_codes')
      .insert({
        user_id,
        old_email: current_email,
        new_email,
        code,
        expires_at: exp
      });
    if (insErr) throw insErr;

    if (DEBUG_EMAILS) {
      return res.json({ ok: true, code, expires_at: exp });
    }
    await sendCodeEmail(new_email, code);
    return res.json({ ok: true, sent: true, expires_at: exp });
  } catch (err) {
    logger.error('[sendEmailChangeCode]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// POST /api/confirmEmailChange
app.post('/api/confirmEmailChange', async (req, res) => {
  try {
    const { user_id, code } = req.body || {};
    if (!user_id || !code) return res.status(400).json({ error: 'Missing fields' });

    // get row
    const { data: row, error: selErr } = await supabase
      .from('email_change_codes')
      .select('*')
      .eq('user_id', user_id)
      .eq('code', code)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!row) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Expired code' });
    }

    const { old_email, new_email } = row;

    // update auth email using admin
    const { error: updErr } = await supabase.auth.admin.updateUserById(user_id, {
      email: new_email
    });
    if (updErr) throw updErr;

    // revoke all sessions
    try {
      await supabase.auth.admin.signOut({ user_id });
      logger.info('[confirmEmailChange] all sessions revoked');
    } catch (e) {
      logger.warn('signOut failed', e?.message);
    }

    // make reset link for new email
    const { data: linkData, error: linkErr } = await supabase.auth.admin
      .generateLink({ type: 'recovery', email: new_email });
    if (linkErr) throw linkErr;

    // warn old email A
    try {
      await sendInfoEmail(
        old_email,
        'Your email was changed',
        `<p>Your account email is now <b>${new_email}</b>.</p>
        <p>If this was not you, click to secure your account:</p>
        <p><a href="${linkData.properties.action_link}">Reset password</a></p>`,
        `Your account email is now ${new_email}. If not you, reset: ${linkData.properties.action_link}`
      );
    } catch {}

    // tell new email B + give reset link
    try {
      await sendInfoEmail(
        new_email,
        'Email updated - set a new password',
        `<p>Your account email is now <b>${new_email}</b>.</p>
        <p>For safety, set a new password now:</p>
        <p><a href="${linkData.properties.action_link}">Set new password</a></p>`,
        `Email updated to ${new_email}. Set new password: ${linkData.properties.action_link}`
      );
    } catch {}

    return res.json({ ok: true, resetLink: linkData });
  } catch (err) {
    logger.error('[confirmEmailChange]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// POST /api/subscriptions/cancel
app.post('/api/subscriptions/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.body || {};
    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscriptionId' });
    }
    await cancelSubscription(supabase, subscriptionId);
    return res.json({ ok: true });
  } catch (err) {
    logger.error('[subscriptions/cancel]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info('server up on http://localhost:' + PORT);
});
