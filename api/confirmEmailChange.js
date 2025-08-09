// Warn old email (pretty)
await sendEmail({
  to: old_email,
  fromName: 'Rav Growth',
  subject: 'Your RavGrowth account email changed',
  html: niceEmail({
    title: 'Your RavGrowth account email changed',
    bodyHTML: `<p>Your account email was changed to <b>${new_email}</b>.</p>
               <p>If this wasn’t you, please secure your account immediately.</p>`,
    buttonText: 'Reset Password',
    buttonLink: actionLink
  }),
  text: `Your email changed to ${new_email}. Reset here: ${actionLink}`
});
