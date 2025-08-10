/* eslint-env node */
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../lib/ses.cjs');
const { niceEmail } = require('../lib/templates.cjs');
const { assertEnv } = require('../lib/env.cjs');
const logger = require('../lib/logger.cjs');

assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEBUG = process.env.NODE_ENV !== 'production' && !!(process.env.RAV_DEBUG_EMAIL || process.env.DEBUG_EMAILS);

module.exports = async (req, res) => {
  const t0 = Date.now();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { user_id, current_email, new_email } = req.body || {};
    const dbg = DEBUG;

    if (dbg) {
      logger.debug('[sendEmailChangeCode] BODY', { user_id, current_email, new_email });
    }

    if (!user_id || !current_email || !new_email) {
      if (dbg) logger.debug('[sendEmailChangeCode] Missing fields');
      return res.status(400).json({ error: 'Missing fields' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error } = await supabase
      .from('email_change_codes')
      .insert({ user_id, old_email: current_email, new_email, code, expires_at: expiresAt });

    if (error) throw error;

    const subject = 'Confirm your new RavGrowth email';
    const confirmUrl = `${process.env.APP_ORIGIN || 'https://app.ravgrowth.com'}/confirm-email-change?code=${code}&uid=${user_id}`;

    const html = niceEmail({
      title: 'Confirm your new email',
      bodyHTML: `<p>We got a request to change your RavGrowth account email to <b>${new_email}</b>.</p>
                 <p>Enter this code within the next <b>10 minutes</b> to confirm the change:</p>
                 <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>`,
      buttonText: 'Confirm Email Change',
      buttonLink: confirmUrl
    });
    const text =
`We got a request to change your RavGrowth email to ${new_email}.
Your confirmation code is: ${code} (valid for 10 minutes).
Confirm here: ${confirmUrl}`;

    if (dbg) {
      logger.debug('[sendEmailChangeCode] PREVIEW SUBJECT', subject);
      logger.debug('[sendEmailChangeCode] PREVIEW TEXT', text);
      logger.debug('[sendEmailChangeCode] HTML length', html?.length);
      return res.json({
        success: true,
        code,
        preview: { subject, text, html, confirmUrl },
        tookMs: Date.now() - t0
      });
    }

    try {
      await sendEmail({ to: new_email, subject, html, text });
      logger.info('[sendEmailChangeCode] Sent to', new_email);
    } catch (err) {
      logger.error('[sendEmailChangeCode] Send fail', err);
      return res.status(500).json({ error: 'Email send fail' });
    }

    return res.json({ success: true, tookMs: Date.now() - t0 });
  } catch (e) {
    logger.error('sendEmailChangeCode', e);
    return res.status(500).json({ error: e.name + ': ' + e.message });
  }
};
