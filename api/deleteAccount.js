/* eslint-env node */
import { createClient } from '@supabase/supabase-js';
import { assertEnv } from '../lib/env.js';
import logger from '../lib/logger.js';

assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function deleteAccount(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    await supabase.from('profiles').delete().eq('id', user_id);
    await supabase.from('settings').delete().eq('user_id', user_id);
    await supabase.from('linked_records').delete().eq('user_id', user_id);

    const { error } = await supabase.auth.admin.deleteUser(user_id, { shouldSoftDelete: false });
    if (error) throw error;

    return res.json({ success: true });
  } catch (e) {
    logger.error('[api/deleteAccount] error', e);
    return res.status(500).json({ error: e.message });
  }
}
