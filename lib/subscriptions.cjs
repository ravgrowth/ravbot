/* eslint-env node */
const logger = require('./logger.cjs');

async function cancelSubscription(supabase, userId, subscriptionId) {
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select('id,user_id,status,merchant_name')
    .eq('id', subscriptionId)
    .single();
  if (error || !sub) {
    const err = new Error('Subscription not found');
    err.status = 404;
    throw err;
  }
  if (sub.user_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  const oldStatus = sub.status;

  let { error: updateError } = await supabase
    .from('subscriptions')
    .update({ status: 'cancel_pending', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId);
  if (updateError) throw updateError;

  ({ error: updateError } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId));
  if (updateError) throw updateError;

  const details = { oldStatus, newStatus: 'cancelled', merchant_name: sub.merchant_name };
  const { error: logError } = await supabase

async function cancelSubscription(supabase, subscriptionId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId)
    .select('user_id')
    .single();
  if (error) throw error;
  const userId = data.user_id;
  const { error: logErr } = await supabase
    .from('subscription_actions')
    .insert({
      user_id: userId,
      subscription_id: subscriptionId,
      action: 'cancel_success',
      details,
    });
  if (logError) {
    logger.error('[cancelSubscription] log fail', logError);
  }

  return { status: 'cancelled' };

      action: 'cancel'
    });
  if (logErr) throw logErr;
  return true;
}

module.exports = { cancelSubscription };
