import { vi, test, expect } from 'vitest';
import Dashboard from './dashboard.jsx';

vi.mock('../supabaseClient', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve({ data: [] })),
      upsert: vi.fn(() => Promise.resolve({})),
      then: (resolve) => Promise.resolve({ data: [] }).then(resolve),
    };
    return builder;
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: '1', email: 't@t.com' } } } }),
      },
      from: vi.fn(() => createBuilder()),
    },
  };
});

test('dashboard component is defined', () => {
  expect(Dashboard).toBeTruthy();
});
