import { describe, it, expect } from 'vitest';
import { sumIdleAmount, groupByInstitution, suggestedMoves } from './idleCash.js';

describe('idleCash helpers', () => {
  it('sums idle amounts from different fields', () => {
    const rows = [
      { idle_amount: 100 },
      { balance: 50 },
      { idle_amount: 0 },
    ];
    expect(sumIdleAmount(rows)).toBe(150);
  });

  it('groups by institution name', () => {
    const rows = [
      { institution_name: 'Bank A', idle_amount: 10 },
      { bank_name: 'Bank B', idle_amount: 20 },
      { account_provider: 'Bank A', idle_amount: 5 },
    ];
    const g = groupByInstitution(rows);
    expect(Object.keys(g).sort()).toEqual(['Bank A', 'Bank B']);
    expect(g['Bank A'].length).toBe(2);
  });

  it('extracts suggested moves ordered by amount', () => {
    const rows = [
      { idle_amount: 10, suggested_target: 'HYSA', est_apy: 0.045 },
      { idle_amount: 200, recommendation: 'S&P 500 ETF', apy: 0.08 },
      { idle_amount: 0, suggested_target: 'CD' },
    ];
    const moves = suggestedMoves(rows);
    expect(moves.length).toBe(2);
    expect(moves[0].target).toContain('S&P');
  });
});

