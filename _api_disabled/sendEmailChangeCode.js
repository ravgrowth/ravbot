// /api/sendEmailChangeCode.js
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../lib/ses.cjs');
const { codeEmailHTML, codeEmailText } = require('../lib/templates.cjs');

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

    const subject = 'Your RavGrowth email change code';
    const html = codeEmailHTML({ code, mins: 10 });
    const text = codeEmailText({ code, mins: 10 });

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
