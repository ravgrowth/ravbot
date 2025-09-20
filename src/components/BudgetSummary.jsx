import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';
import { log, logError } from '../utils/log.js';

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundToOne(value) {
  return Number(value.toFixed(1));
}

export default function BudgetSummary({ userId }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [r, setR] = useState('50');
  const [e, setE] = useState('30');
  const [l, setL] = useState('20');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        log('[BudgetSummary]', 'load start', { userId });
        const { data } = await supabase
          .from('user_budgets')
          .select('user_id, rent, essentials, lifestyle, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        setBudget(row);
        log('[BudgetSummary]', 'load done', { found: row ? 1 : 0 });
      } catch (err) {
        logError('[BudgetSummary]', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) load();
  }, [userId]);

  useEffect(() => {
    if (!budget) return;
    setR(String(budget.rent ?? 50));
    setE(String(budget.essentials ?? 30));
    setL(String(budget.lifestyle ?? 20));
  }, [budget]);

  const numeric = useMemo(() => {
    const rent = toNumber(r, 0);
    const essentials = toNumber(e, 0);
    const lifestyle = toNumber(l, 0);
    return { rent, essentials, lifestyle, total: rent + essentials + lifestyle };
  }, [r, e, l]);

  const normalized = useMemo(() => {
    const { rent, essentials, lifestyle, total } = numeric;
    if (!total || Math.abs(total - 100) < 0.5) return null;
    const scale = 100 / total;
    const rentScaled = roundToOne(rent * scale);
    const essentialsScaled = roundToOne(essentials * scale);
    let lifestyleScaled = roundToOne(lifestyle * scale);
    const sum = rentScaled + essentialsScaled + lifestyleScaled;
    if (sum !== 100) {
      const diff = roundToOne(100 - sum);
      lifestyleScaled = roundToOne(lifestyleScaled + diff);
    }
    return {
      rent: rentScaled,
      essentials: essentialsScaled,
      lifestyle: lifestyleScaled,
      originalTotal: total,
    };
  }, [numeric]);

  const barValues = normalized || numeric;

  const save = async () => {
    try {
      log('[BudgetSummary]', 'save start', numeric);
      const row = {
        user_id: userId,
        rent: toNumber(r, 0),
        essentials: toNumber(e, 0),
        lifestyle: toNumber(l, 0),
      };
      const { error } = await supabase.from('user_budgets').insert(row);
      if (error) throw error;
      log('[BudgetSummary]', 'save ok');
    } catch (err) {
      logError('[BudgetSummary]', err, numeric);
      alert('Save failed');
    }
  };

  return (
    <Card title="Budget Allocation">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Rent/Housing:</span>
            <input type="number" value={r} onChange={(event) => setR(event.target.value)} style={{ width: 80 }} />%
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Essentials:</span>
            <input type="number" value={e} onChange={(event) => setE(event.target.value)} style={{ width: 80 }} />%
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Lifestyle:</span>
            <input type="number" value={l} onChange={(event) => setL(event.target.value)} style={{ width: 80 }} />%
          </div>
          <button onClick={save}>Save</button>
          <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden', marginTop: 6, display: 'flex' }}>
            <div style={{ width: `${Math.max(0, barValues.rent)}%`, background: '#bcd4ff' }}></div>
            <div style={{ width: `${Math.max(0, barValues.essentials)}%`, background: '#c8e6c9' }}></div>
            <div style={{ width: `${Math.max(0, barValues.lifestyle)}%`, background: '#ffe0b2' }}></div>
          </div>
          {normalized && (
            <div style={{ fontSize: '0.85rem', color: '#0b5fff' }}>
              Inputs sum to {normalized.originalTotal.toFixed(1)}%. Normalized suggestion: Rent {normalized.rent}% - Essentials {normalized.essentials}% - Lifestyle {normalized.lifestyle}%.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
