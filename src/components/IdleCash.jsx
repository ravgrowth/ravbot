import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';

export default function IdleCash({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [v1, v2] = await Promise.all([
          supabase.from('idle_cash_recommendations').select('*').eq('user_id', userId),
          supabase
            .from('idle_cash_recommendations_v2')
            .select('user_id, balance, estimated_yearly_gain, account_name, institution_name, bank_name, suggested_target, est_apy, recommendation, apy, account_id')
            .eq('user_id', userId),
        ]);
        const r1 = v1.data || [];
        const r2 = v2.data || [];
        setRows([...r1, ...r2]);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const totalIdle = useMemo(() => rows.reduce((sum, r) => sum + Number(r.idle_amount ?? r.balance ?? 0), 0), [rows]);
  const suggestions = useMemo(() => {
    const list = rows
      .map((r) => ({
        amount: Number(r.idle_amount ?? r.balance ?? 0),
        account: r.account_name || r.account_id || 'Account',
        bank: r.institution_name || r.bank_name || 'Bank',
        target: r.suggested_target || r.recommendation || 'High-Yield Savings (e.g., Ally, 4.5% APY)',
        apy: r.est_apy ?? r.apy ?? null,
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return list;
  }, [rows]);

  return (
    <Card title={`Idle Cash (${totalIdle.toLocaleString(undefined, { style: 'currency', currency: 'USD' })})`}>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : suggestions.length === 0 ? (
        <p>Nice! No obvious idle balances found.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {suggestions.map((s, idx) => (
            <li
              key={`${s.bank}-${s.account}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #eee',
                transition: 'transform 200ms ease, background 200ms ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{s.bank} · {s.account}</div>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>
                  Move to: {s.target} {s.apy ? `(${(Number(s.apy) * 100).toFixed(1)}% APY)` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>
                  {s.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                </div>
                <button
                  onClick={() => {
                    const q = encodeURIComponent(`open ${s.target} account`);
                    window.open(`https://www.google.com/search?q=${q}`,'_blank','noopener,noreferrer');
                  }}
                >
                  Move
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#666' }}>
        Suggestions are informational only. Always verify APYs and terms.
      </div>
    </Card>
  );
}
