import { describe, it, expect, vi } from 'vitest';
import { cancelSubscription } from './subscriptions.js';

describe('cancelSubscription', () => {
  it('verifies ownership, updates status twice, and logs action', async () => {
    // Read chain: from('subscriptions').select(...).eq(...).single()
    const single = vi.fn().mockResolvedValue({ data: { id: 'sub1', user_id: 'u1', status: 'detected' }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });

    // Update chain: from('subscriptions').update(...).eq(...)
    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: eqUpdate });

    // Insert action: from('subscription_actions').insert(...)
    const insert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table) => {
      if (table === 'subscriptions') return { select, update };
      if (table === 'subscription_actions') return { insert };
      return {};
    });
    const supabase = { from };

    const result = await cancelSubscription(supabase, 'u1', 'sub1');

    // Two updates: cancel_pending then cancelled
    expect(update).toHaveBeenNthCalledWith(1, { status: 'cancel_pending' });
    expect(update).toHaveBeenNthCalledWith(2, { status: 'cancelled' });
    expect(eqUpdate).toHaveBeenCalledTimes(2);
    expect(eqUpdate).toHaveBeenCalledWith('id', 'sub1');

    // Two inserts: cancel_request then cancel_success
    expect(insert).toHaveBeenNthCalledWith(1, {
      user_id: 'u1',
      subscription_id: 'sub1',
      action: 'cancel_request'
    });
    expect(insert).toHaveBeenNthCalledWith(2, {
      user_id: 'u1',
      subscription_id: 'sub1',
      action: 'cancel_success'
    });
    expect(result).toEqual({ status: 'cancelled' });
  });
});
