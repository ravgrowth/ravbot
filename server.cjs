// server.cjs
require('dotenv').config({ path: '.env.server' }); // load server env FIRST
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.server');
  process.exit(1);
}

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('./lib/ses.cjs');
const { codeEmailHTML, codeEmailText } = require('./lib/templates.cjs');

const app = express();
app.use(express.json());

// Supabase (service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Send code
// Send code
app.post('/api/sendEmailChangeCode', async (req, res) => {
  try {
    const { user_id, current_email, new_email } = req.body;
    if (!user_id || !current_email || !new_email) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error } = await supabase.from('email_change_codes').insert({
      user_id,
      old_email: current_email,
      new_email,
      code,
      expires_at: expiresAt
    });
    if (error) throw error;

    // send email via SES
    const subject = 'Your RavGrowth email change code';
    const html = codeEmailHTML({ code, mins: 10 });
    const text = codeEmailText({ code, mins: 10 });

    await sendEmail({ to: new_email, subject, html, text });

    console.log('[OK] sent code to', new_email);
    res.json({ success: true });
  } catch (e) {
    console.error('sendEmailChangeCode:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Confirm code → update email
app.post('/api/confirmEmailChange', async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) return res.status(400).json({ error: 'Missing fields' });

    const { data, error } = await supabase
      .from('email_change_codes')
      .select('*')
      .eq('user_id', user_id)
      .eq('code', code)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(data.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Expired code' });
    }

    const { old_email, new_email } = data;

    // 1) Update auth email
    const upd = await supabase.auth.admin.updateUserById(user_id, { email: new_email });
    if (upd.error) throw upd.error;

    // 2) Generate recovery link for new email
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: new_email,
      options: { redirectTo: `${process.env.APP_ORIGIN || 'http://localhost:5173'}/reset` }
    });
    if (linkErr) throw linkErr;

    const actionLink = link?.properties?.action_link || link?.action_link;

    // 3) Warn old email
    await sendEmail({
      to: old_email,
      subject: 'Your RavGrowth account email changed',
      html: `<p>Your account email was changed to <b>${new_email}</b>.</p>
             <p>If this wasn’t you, reset your password immediately:<br/>
             <a href="${actionLink}">${actionLink}</a></p>`,
      text: `Your email changed to ${new_email}.
If this wasn't you, reset your password: ${actionLink}`
    });

    // 4) Confirm to new email with reset prompt
    await sendEmail({
      to: new_email,
      subject: 'Email updated - set your new password',
      html: `<p>We updated your account email to <b>${new_email}</b>.</p>
             <p>For security, set a new password now:<br/>
             <a href="${actionLink}">${actionLink}</a></p>`,
      text: `We updated your email to ${new_email}.
Set a new password: ${actionLink}`
    });

    // 5) Return success
    res.json({ success: true });
  } catch (e) {
    console.error('confirmEmailChange:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

app.listen(8787, () => console.log('API http://localhost:8787'));
