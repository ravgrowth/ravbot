import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';
import { log, logError } from '../utils/log.js';

export default function BudgetSummary({ userId }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        log('[BudgetSummary]', 'load start', { userId })
        const { data } = await supabase
          .from('user_budgets')
          .select('user_id, rent, essentials, lifestyle, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        setBudget(Array.isArray(data) && data.length > 0 ? data[0] : null);
        log('[BudgetSummary]', 'load done', { found: Array.isArray(data) ? data.length : 0 })
      } catch (e) {
        logError('[BudgetSummary]', e)
      } finally {
        setLoading(false);
      }
    };
    if (userId) load();
  }, [userId]);

  const [r, setR] = useState(50)
  const [e, setE] = useState(30)
  const [l, setL] = useState(20)
  useEffect(() => {
    setR(Number(budget?.rent ?? 50));
    setE(Number(budget?.essentials ?? 30));
    setL(Number(budget?.lifestyle ?? 20));
  }, [budget])

  const save = async () => {
    try {
      log('[BudgetSummary]', 'save start', { r, e, l })
      const row = { user_id: userId, rent: Number(r), essentials: Number(e), lifestyle: Number(l) }
      const { error } = await supabase.from('user_budgets').insert(row)
      if (error) throw error
      log('[BudgetSummary]', 'save ok')
    } catch (err) {
      logError('[BudgetSummary]', err, { r, e, l })
      alert('Save failed')
    }
  }

  return (
    <Card title="Budget Allocation">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Rent/Housing:</span>
            <input type="number" value={r} onChange={e=>setR(e.target.value)} style={{ width: 80 }} />%
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Essentials:</span>
            <input type="number" value={e} onChange={ev=>setE(ev.target.value)} style={{ width: 80 }} />%
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Lifestyle:</span>
            <input type="number" value={l} onChange={ev=>setL(ev.target.value)} style={{ width: 80 }} />%
          </div>
          <button onClick={save}>Save</button>
          <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${r}%`, height: '100%', background: '#bcd4ff', float: 'left' }}></div>
            <div style={{ width: `${e}%`, height: '100%', background: '#c8e6c9', float: 'left' }}></div>
            <div style={{ width: `${l}%`, height: '100%', background: '#ffe0b2', float: 'left' }}></div>
          </div>
        </div>
      )}
    </Card>
  );
}
