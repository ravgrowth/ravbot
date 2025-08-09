// /api/sendEmailChangeCode.js
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../lib/ses.cjs');
const { niceEmail } = require('../lib/templates.cjs'); // use the same pretty template

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { user_id, current_email, new_email } = req.body || {};
    if (!user_id || !current_email || !new_email) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error } = await supabase
      .from('email_change_codes')
      .insert({ user_id, old_email: current_email, new_email, code, expires_at: expiresAt });

    if (error) throw error;

    const subject = 'Confirm your new RavGrowth email';
    const html = niceEmail({
      title: 'Confirm your new email',
      bodyHTML: `<p>We got a request to change your RavGrowth account email to <b>${new_email}</b>.</p>
                 <p>Enter this code within the next <b>10 minutes</b> to confirm the change:</p>
                 <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>`,
      buttonText: 'Confirm Email Change',
      buttonLink: `${process.env.APP_ORIGIN || 'https://app.ravgrowth.com'}/confirm-email-change?code=${code}&uid=${user_id}`
    });
    const text = `We got a request to change your RavGrowth email to ${new_email}.
Your confirmation code is: ${code} (valid for 10 minutes).
Confirm here: ${process.env.APP_ORIGIN || 'https://app.ravgrowth.com'}/confirm-email-change?code=${code}&uid=${user_id}`;

    try {
      await sendEmail({
        to: new_email,
        fromName: 'Rav Growth',
        subject,
        html,
        text
      });
    } catch (err) {
      console.error('Send fail', err);
      return res.status(500).json({ error: 'Email send fail' });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('sendEmailChangeCode:', e);
    return res.status(500).json({ error: e.name + ': ' + e.message });
  }
};
