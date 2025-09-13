import logger from './logger.js';

// Cancels a subscription after verifying ownership.
// Writes an action log to subscription_actions.
export async function cancelSubscription(supabase, userId, subscriptionId) {
  logger.debug('[cancelSubscription] args', { user_id: userId, subscription_id: subscriptionId });
  // Verify subscription belongs to user
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('id,user_id,status,merchant_name')
    .eq('id', subscriptionId)
    .single();
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

  // Log attempt first
  try {
    await supabase
      .from('subscription_actions')
      .insert({ user_id: userId, subscription_id: subscriptionId, action: 'cancel_request' });
  } catch (e) {
    logger.warn('[cancelSubscription] cancel_request log failed', e?.message || e);
  }

  // Update status -> cancel_pending -> cancelled
  let { error: upErr } = await supabase
    .from('subscriptions')
    .update({ status: 'cancel_pending' })
    .eq('id', subscriptionId);
  if (upErr) throw upErr;

  ({ error: upErr } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId));
  if (upErr) throw upErr;

  // Action log (schema: user_id, subscription_id, action)
  const { error: logErr } = await supabase
    .from('subscription_actions')
    .insert({ user_id: userId, subscription_id: subscriptionId, action: 'cancel_success' });
  if (logErr) {
    logger.error('[cancelSubscription] action log failed', logErr);
  }

  return { status: 'cancelled' };
}

