import subs from './subscriptions.cjs';
import { describe, it, expect, vi } from 'vitest';

const { cancelSubscription } = subs;

describe('cancelSubscription', () => {
  it('updates subscription and logs action', async () => {
    const single = vi.fn().mockResolvedValue({ data: { user_id: 'u1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table) => {
      if (table === 'subscriptions') return { update };
      if (table === 'subscription_actions') return { insert };
      return {};
    });
    const supabase = { from };

    await cancelSubscription(supabase, 'sub1');

    expect(update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(eq).toHaveBeenCalledWith('id', 'sub1');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1',
      subscription_id: 'sub1',
      action: 'cancel'
    });
  });
});
