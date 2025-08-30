import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, expect, test } from 'vitest';
import Dashboard from './dashboard.jsx';

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 't@t.com' } } } }),
      signOut: vi.fn()
    }
  }
}));

test('cancel removes subscription', async () => {
  const fetchMock = vi.fn((url) => {
    if (url === '/api/subscriptions/scan') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ subscriptions: [{ id: '1', name: 'Test Sub' }] }) });
    }
    if (url === '/api/subscriptions/cancel') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.reject(new Error('unknown url'));
  });
  globalThis.fetch = fetchMock;

  render(<Dashboard />);

  await screen.findByText('Test Sub');
  fireEvent.click(screen.getByText('Cancel'));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/subscriptions/cancel', expect.any(Object));
    expect(screen.queryByText('Test Sub')).not.toBeInTheDocument();
  });
});
