export function codeEmailHTML({ brand = 'RavGrowth', code, mins = 10 }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${brand} – Verify Email Change</title></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.05);padding:28px">
    <div style="text-align:center;margin-bottom:16px">
      <img src="https://app.ravgrowth.com/logo.png" alt="${brand}" width="120" style="display:inline-block"/>
    </div>
    <h2 style="margin:0 0 8px;color:#0b5fff">Confirm Your Email Change</h2>
    <p style="margin:8px 0;color:#333">Use this code to confirm the change to your new email:</p>
    <div style="text-align:center;margin:20px 0 16px">
      <span style="display:inline-block;font-size:28px;letter-spacing:6px;font-weight:700;padding:14px 18px;border:2px dashed #0b5fff;border-radius:8px;background:#f0f6ff">
        ${code}
      </span>
    </div>
    <p style="margin:8px 0;color:#444">This code expires in <b>${mins} minutes</b>. If you didn't request this, you can ignore this email.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888;margin:0">© ${new Date().getFullYear()} ${brand} · <a href="https://ravgrowth.com" style="color:#888;text-decoration:none">ravgrowth.com</a></p>
  </div>
  </body></html>`;
}

export function emailChangedHTML({ brand = 'RavGrowth', oldEmail, newEmail, link }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${brand} – Email Changed</title></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.05);padding:28px">
    <div style="text-align:center;margin-bottom:16px">
      <img src="https://app.ravgrowth.com/logo.png" alt="${brand}" width="120" style="display:inline-block"/>
    </div>
    <h2 style="margin:0 0 8px;color:#0b5fff">Your Email Was Changed</h2>
    <p style="margin:8px 0;color:#333">Your account email was changed from <b>${oldEmail}</b> to <b>${newEmail}</b>.</p>
    <p style="margin:8px 0;color:#333">If this was <b>not you</b>, secure your account now:</p>
    <div style="text-align:center;margin:20px 0 16px">
      <a href="${link}" style="display:inline-block;background:#0b5fff;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Reset Password</a>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888;margin:0">© ${new Date().getFullYear()} ${brand} · <a href="https://ravgrowth.com" style="color:#888;text-decoration:none">ravgrowth.com</a></p>
  </div>
  </body></html>`;
}

export function emailUpdatedHTML({ brand = 'RavGrowth', newEmail, link }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${brand} – Email Updated</title></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.05);padding:28px">
    <div style="text-align:center;margin-bottom:16px">
      <img src="https://app.ravgrowth.com/logo.png" alt="${brand}" width="120" style="display:inline-block"/>
    </div>
    <h2 style="margin:0 0 8px;color:#0b5fff">Email Updated – Set New Password</h2>
    <p style="margin:8px 0;color:#333">We updated your account email to <b>${newEmail}</b>.</p>
    <p style="margin:8px 0;color:#333">For security, please set a new password now:</p>
    <div style="text-align:center;margin:20px 0 16px">
      <a href="${link}" style="display:inline-block;background:#0b5fff;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Set New Password</a>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888;margin:0">© ${new Date().getFullYear()} ${brand} · <a href="https://ravgrowth.com" style="color:#888;text-decoration:none">ravgrowth.com</a></p>
  </div>
  </body></html>`;
}

export function niceEmail({ title, bodyHTML, buttonText, buttonLink }) {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 40px; color: #333;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">

        <div style="text-align: center; margin-bottom: 24px;">
          <img src="https://app.ravgrowth.com/logo.png" alt="RavGrowth Logo" width="120" style="margin-bottom: 16px;" />
        </div>

        <h2 style="color: #007aff;">${title}</h2>
        ${bodyHTML}

        ${
          buttonText && buttonLink
            ? `<p style=\"text-align: center; margin: 30px 0;\">
                 <a href=\"${buttonLink}\" style=\"background-color: #007aff; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: bold;\">
                   ${buttonText}
                 </a>
               </p>`
            : ''
        }

        <p style="font-size: 12px; color: #aaa; margin-top: 24px;">&copy; ${new Date().getFullYear()} RavGrowth | <a href="https://ravgrowth.com" style="color: #aaa;">ravgrowth.com</a></p>
      </div>
    </body>
  </html>
  `;
}

export function codeEmailText({ brand = 'RavGrowth', code, mins = 10 }) {
  return `${brand} – Confirm your email change

Your verification code: ${code}
This code expires in ${mins} minutes.

If you didn't request this, ignore this email.`;
}

