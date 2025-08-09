// At top of server.cjs
const { niceEmail } = require('./lib/templates.cjs');

// Confirm code → update email
app.post('/api/confirmEmailChange', async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Get code record
    const { data: row, error } = await supabase
      .from('email_change_codes')
      .select('*')
      .eq('user_id', user_id)
      .eq('code', code)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!row) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Expired code' });
    }

    const { old_email, new_email } = row;

    // Change email in Supabase Auth plz plz zpl zpl zplzplzplzplpl  
    const upd = await supabase.auth.admin.updateUserById(user_id, { email: new_email });
    if (upd.error) throw upd.error;

    // Create password reset link
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: new_email,
      options: { redirectTo: `${process.env.APP_ORIGIN || 'https://app.ravgrowth.com'}/reset` }
    });
    if (linkErr) throw linkErr;
    const actionLink = link?.properties?.action_link || link?.action_link;
    if (!actionLink) throw new Error('No action link generated');

    // Warn old email (pretty)
    await sendEmail({
      to: old_email,
      fromName: 'Rav Growth',
      subject: 'Your RavGrowth account email changed',
      html: niceEmail({
        title: 'Your RavGrowth account email changed',
        bodyHTML: `<p>Your account email was changed to <b>${new_email}</b>.</p>
                   <p>If this wasn’t you, reset your password immediately.</p>`,
        buttonText: 'Reset Password',
        buttonLink: actionLink
      }),
      text: `Your email changed to ${new_email}. Reset: ${actionLink}`
    });

    // Confirm to new email (pretty)
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

    res.json({ success: true });
  } catch (e) {
    console.error('confirmEmailChange:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});
