// /api/confirmEmailChange.js
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../lib/ses.cjs');
const { niceEmail } = require('../lib/templates.cjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, code } = req.body || {};
    if (!user_id || !code) {
      return res.status(400).json({ error: 'Missing user_id or code' });
    }

    // 1. Fetch matching code
    const { data: codeRow, error: fetchErr } = await supabase
      .from('email_change_codes')
      .select('*')
      .eq('user_id', user_id)
      .eq('code', code)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!codeRow) return res.status(400).json({ error: 'Invalid code' });

    if (new Date(codeRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code expired' });
    }

    const { old_email, new_email } = codeRow;

    // 2. Change email in Supabase Auth
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user_id, { email: new_email });
    if (updateErr) {
      return res.status(400).json({ error: updateErr.message });
    }

    // 3. Create password reset link for new email
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: new_email,
      options: {
        redirectTo: `${process.env.APP_ORIGIN || 'http://localhost:5173'}/reset`
      }
    });
    if (linkErr) throw linkErr;

    const actionLink = linkData?.properties?.action_link || linkData?.action_link;
    if (!actionLink) throw new Error('No action link generated');

    // 4. Notify old email
    await sendEmail({
      to: old_email,
      fromName: 'Rav Growth',
      subject: 'Your RavGrowth account email changed',
      html: niceEmail({
        title: 'Your RavGrowth account email changed',
        bodyHTML: `<p>Your account email was changed to <b>${new_email}</b>.</p>
                   <p>If this was not you, reset your password now.</p>`,
        buttonText: 'Reset Password',
        buttonLink: actionLink
      }),
      text: `Your email changed to ${new_email}. Reset: ${actionLink}`
    });

    // 5. Notify new email
    await sendEmail({
      to: new_email,
      fromName: 'Rav Growth',
      subject: 'Email updated - set your new password',
      html: niceEmail({
        title: 'Email updated - set your new password',
        bodyHTML: `<p>We updated your email to <b>${new_email}</b>.</p>`,
        buttonText: 'Set New Password',
        buttonLink: actionLink
      }),
      text: `We updated your email to ${new_email}. Set a new password: ${actionLink}`
    });

    console.log('[confirmEmailChange] Emails sent to:', { old_email, new_email });
    return res.json({ success: true });

  } catch (e) {
    console.error('confirmEmailChange error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
