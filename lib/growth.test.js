import { describe, it, expect } from 'vitest';
import { annualGain, growthGap, lifestyleEquivalents } from './growth.js';

describe('growth helpers', () => {
  it('annualGain computes principal * rate', () => {
    expect(annualGain(1000, 0.05)).toBeCloseTo(50);
  });

  it('growthGap clamps to non-negative deltas', () => {
    expect(growthGap(1000, 0.08, 0.01)).toBeCloseTo(70);
    expect(growthGap(1000, 0.01, 0.08)).toBeCloseTo(0);
  });

  it('lifestyle equivalents returns readable items', () => {
    const eqs = lifestyleEquivalents(1000);
    expect(Array.isArray(eqs)).toBe(true);
    expect(eqs.join(' ')).toMatch(/groceries|flight|Spotify|coffee/);
  });
});

