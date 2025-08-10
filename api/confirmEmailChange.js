// POST /api/confirmEmailChange
app.post('/api/confirmEmailChange', async (req, res) => {
  const DEBUG = !!(process.env.RAV_DEBUG_EMAIL || process.env.DEBUG_EMAILS);

  try {
    const { user_id, code } = req.body || {};
    if (!user_id || !code) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // 1) get latest valid code
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

    // 2) change email A → B
    const { error: updErr } = await supabase.auth.admin.updateUserById(user_id, {
      email: new_email
    });
    if (updErr) throw updErr;

    // 3) kill ALL refresh tokens / sessions
    try {
      if (supabase.auth.admin.invalidateAllRefreshTokens) {
        await supabase.auth.admin.invalidateAllRefreshTokens(user_id);
        console.log('[confirmEmailChange] refresh tokens invalidated for', user_id);
      } else if (supabase.auth.admin.signOut) {
        await supabase.auth.admin.signOut({ user_id });
        console.log('[confirmEmailChange] all sessions revoked for', user_id);
      } else {
        console.warn('[confirmEmailChange] No admin token revoke method found');
      }
    } catch (e) {
      console.warn('[confirmEmailChange] session revoke failed', e?.message);
    }

    // 4) make a password reset link for B
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: new_email
    });
    if (linkErr) throw linkErr;

    const actionLink = linkData?.properties?.action_link || null;
    if (!actionLink) {
      throw new Error('No action_link from Supabase');
    }

    // 5) send warn to A
    const warnSubject = 'Your RavGrowth account email changed';
    const warnHtml = niceEmail({
      title: 'Your RavGrowth account email changed',
      bodyHtml: `<p>Your account email was changed to <b>${new_email}</b>.</p>
                 <p>If this wasn’t you, please secure your account now.</p>`,
      ctaText: 'Reset password',
      ctaHref: actionLink
    });
    const warnText = `Your email changed to ${new_email}. If this was not you, reset here: ${actionLink}`;

    if (DEBUG) {
      console.log('[confirmEmailChange] WARN OLD EMAIL PREVIEW ->', {
        to: old_email, subject: warnSubject, text: warnText, htmlLength: warnHtml.length
      });
    } else {
      await sendEmail({
        to: old_email,
        fromName: 'Rav Growth',
        subject: warnSubject,
        html: warnHtml,
        text: warnText
      });
    }

    // 6) send confirm to B with reset CTA
    const okSubject = 'Email updated - set a new password';
    const okHtml = niceEmail({
      title: 'Email updated',
      bodyHtml: `<p>Your account email is now <b>${new_email}</b>.</p>
                 <p>For safety, please set a new password now.</p>`,
      ctaText: 'Set new password',
      ctaHref: actionLink
    });
    const okText = `Email updated to ${new_email}. Set a new password: ${actionLink}`;

    if (DEBUG) {
      console.log('[confirmEmailChange] OK NEW EMAIL PREVIEW ->', {
        to: new_email, subject: okSubject, text: okText, htmlLength: okHtml.length
      });
    } else {
      await sendEmail({
        to: new_email,
        fromName: 'Rav Growth',
        subject: okSubject,
        html: okHtml,
        text: okText
      });
    }

    // 7) done — also tell front end to logout
    console.log('[confirmEmailChange] SUCCESS payload:', {
      user_id, old_email, new_email, actionLink
    });

    return res.json({
      ok: true,
      action_link: actionLink,
      forceLogout: true // front-end can check this and call hardLogout()
    });

  } catch (err) {
    console.error('[confirmEmailChange]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});
