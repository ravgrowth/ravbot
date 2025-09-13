/* eslint-env node */
const logger = require('./logger.cjs');

// Cancels a subscription after verifying ownership.
// Writes an action log to subscription_actions.
async function cancelSubscription(supabase, userId, subscriptionId) {
  console.log('[cancelSubscription] args', { user_id: userId, subscription_id: subscriptionId });
  // Verify subscription belongs to user
  console.log('[cancelSubscription] query subscription start');
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('id,user_id,status,merchant_name')
    .eq('id', subscriptionId)
    .single();
  console.log('[cancelSubscription] query subscription result', { data: sub, error: fetchErr });
  if (fetchErr || !sub) {
    const err = new Error('Subscription not found');
    err.status = 404;
    throw err;
  }
  if (sub.user_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  // Update status -> cancel_pending -> cancelled
  console.log('[cancelSubscription] update -> cancel_pending start');
  let { error: upErr } = await supabase
    .from('subscriptions')
    .update({ status: 'cancel_pending' })
    .eq('id', subscriptionId);
  console.log('[cancelSubscription] update -> cancel_pending result', { error: upErr });
  if (upErr) throw upErr;

  console.log('[cancelSubscription] update -> cancelled start');
  ({ error: upErr } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId));
  console.log('[cancelSubscription] update -> cancelled result', { error: upErr });
  if (upErr) throw upErr;

  // Action log (schema: user_id, subscription_id, action)
  console.log('[cancelSubscription] insert action log start');
  const { error: logErr } = await supabase
    .from('subscription_actions')
    .insert({ user_id: userId, subscription_id: subscriptionId, action: 'cancel_success' });
  console.log('[cancelSubscription] insert action log result', { error: logErr });
  if (logErr) {
    logger.error('[cancelSubscription] action log failed', logErr);
  }

  return { status: 'cancelled' };
}

module.exports = { cancelSubscription };
