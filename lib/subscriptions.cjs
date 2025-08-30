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
      action: 'cancel'
    });
  if (logErr) throw logErr;
  return true;
}

module.exports = { cancelSubscription };
