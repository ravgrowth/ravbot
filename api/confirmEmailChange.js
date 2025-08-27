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

    const { user_id, code } = req.body || {};
    const dbg = DEBUG;

    if (dbg) logger.debug('[confirmEmailChange] BODY', { user_id, code });

    if (!user_id || !code) {
      if (dbg) logger.debug('[confirmEmailChange] Missing fields');
      return res.status(400).json({ error: 'Missing fields' });
    }

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
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Expired code' });

    const { old_email, new_email } = row;
    if (dbg) logger.debug('[confirmEmailChange] Found row', row);

    const { error: updErr } = await supabase.auth.admin.updateUserById(user_id, { email: new_email });
    if (updErr) throw updErr;
    logger.info('[confirmEmailChange] Updated user email', old_email, '→', new_email);

    try {
      if (supabase.auth.admin.invalidateAllRefreshTokens) {
        await supabase.auth.admin.invalidateAllRefreshTokens(user_id);
        logger.info('[confirmEmailChange] refresh tokens invalidated for', user_id);
      } else if (supabase.auth.admin.signOut) {
        await supabase.auth.admin.signOut({ user_id });
        logger.info('[confirmEmailChange] all sessions revoked for', user_id);
      } else {
        logger.warn('[confirmEmailChange] No admin token revoke method found');
      }
    } catch (e) {
      logger.warn('[confirmEmailChange] session revoke failed', e?.message);
    }

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: new_email
    });
    if (linkErr) throw linkErr;

    const actionLink = linkData?.properties?.action_link || null;
    if (!actionLink) throw new Error('No action_link from Supabase');

    const warnSubject = 'Your RavGrowth account email changed';
    const warnHtml = niceEmail({
      title: 'Your RavGrowth account email changed',
      bodyHTML: `<p>Your account email was changed to <b>${new_email}</b>.</p>
                 <p>If this wasn’t you, please secure your account now.</p>`,
      buttonText: 'Reset password',
      buttonLink: actionLink
    });
    const warnText = `Your email changed to ${new_email}. If this was not you, reset here: ${actionLink}`;

    if (dbg) {
      logger.debug('[confirmEmailChange] WARN OLD EMAIL PREVIEW', { to: old_email, subject: warnSubject });
    } else {
      await sendEmail({
        to: old_email,
        subject: warnSubject,
        html: warnHtml,
        text: warnText
      });
    }

    const okSubject = 'Email updated - set a new password';
    const okHtml = niceEmail({
      title: 'Email updated',
      bodyHTML: `<p>Your account email is now <b>${new_email}</b>.</p>
                 <p>For safety, please set a new password now.</p>`,
      buttonText: 'Set new password',
      buttonLink: actionLink
    });
    const okText = `Email updated to ${new_email}. Set a new password: ${actionLink}`;

    if (dbg) {
      logger.debug('[confirmEmailChange] OK NEW EMAIL PREVIEW', { to: new_email, subject: okSubject });
    } else {
      await sendEmail({
        to: new_email,
        subject: okSubject,
        html: okHtml,
        text: okText
      });
    }

    logger.info('[confirmEmailChange] SUCCESS payload', { user_id, old_email, new_email, actionLink });

    return res.json({
      ok: true,
      resetLink: linkData,
      action_link: actionLink,
      forceLogout: true,
      tookMs: Date.now() - t0
    });
  } catch (err) {
    logger.error('[confirmEmailChange]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
