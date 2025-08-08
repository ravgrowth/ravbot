/* eslint-env node */
/* global process */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to, subject, text) {
  const projectRef = new URL(process.env.SUPABASE_URL).host.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      to: [to],
      subject,
      content: text,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send email');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, new_email } = req.body || {};

  if (!user_id || !new_email) {
    return res.status(400).json({ error: 'user_id and new_email are required' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('email_change_codes')
    .insert({ user_id, new_email, code, expires_at });

  if (insertError) {
    console.error(insertError);
    return res.status(500).json({ error: 'Failed to store verification code' });
  }

  try {
    await sendEmail(
      new_email,
      'Rav Growth - Verify your new email',
      `Your verification code is ${code}. It expires in 10 minutes.`
    );
  } catch (emailError) {
    console.error(emailError);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ success: true });
}
