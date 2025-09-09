/* eslint-env node */
const { createClient } = require('@supabase/supabase-js');
const { assertEnv } = require('../lib/env.cjs');
const logger = require('../lib/logger.cjs');
const { cancelSubscription } = require('../lib/subscriptions.cjs');

assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { subscriptionId } = req.body || {};
    if (!subscriptionId) return res.status(400).json({ error: 'Missing subscriptionId' });

    const result = await cancelSubscription(supabase, user.id, subscriptionId);
    return res.json({ ok: true, status: result.status });
  } catch (e) {
    logger.error('cancelSubscription', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
};
