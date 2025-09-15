import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';
import { log, logError } from '../utils/log.js';

function computeGrowthGap(idle, betterRate = 0.045, currentRate = 0) {
  return Math.max(0, betterRate - currentRate) * idle;
}

function equivalents(amount) {
  const items = [
    { label: 'months of Spotify', cost: 11.0 },
    { label: 'coffee per day (1 year)', cost: 4.0 * 365 },
    { label: 'roundtrip domestic flight', cost: 350 },
    { label: 'week of groceries', cost: 120 },
  ];
  const out = [];
  for (const it of items) {
    const qty = amount / it.cost;
    if (qty >= 1) out.push(`${Math.floor(qty)} ${it.label}`);
  }
  return out;
}

export default function GrowthGap({ userId }) {
  const [idleTotal, setIdleTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        log('[GrowthGap]', 'load start', { userId })
        const [v1, v2] = await Promise.all([
          supabase.from('idle_cash_recommendations').select('idle_amount').eq('user_id', userId),
          supabase.from('idle_cash_recommendations_v2').select('balance, estimated_yearly_gain').eq('user_id', userId),
        ]);
        const rows = [...(v1.data || []), ...(v2.data || [])];
        const total = rows.reduce((acc, r) => acc + Number(r.idle_amount ?? r.balance ?? 0), 0);
        setIdleTotal(total);
        log('[GrowthGap]', 'load done', { idleTotal: total })
      } catch (e) {
        logError('[GrowthGap]', e)
      } finally {
        setLoading(false)
      }
    };
    load();
  }, [userId]);

  const yearly = useMemo(() => computeGrowthGap(idleTotal, 0.08, 0.01), [idleTotal]);
  const lifestyle = useMemo(() => equivalents(yearly), [yearly]);

  useEffect(() => {
    const fetchExposure = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const resp = await fetch('/api/investmentExposure', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await resp.json();
        if (json?.alerts) setAlerts(json.alerts);
      } catch (e) { logError('[GrowthGap exposure]', e) }
    };
    fetchExposure();
  }, []);

  return (
    <Card title="Growth Gap">
      {loading ? (
        <p>Computing...</p>
      ) : idleTotal <= 0 ? (
        <p>No idle cash detected. Great job putting money to work.</p>
      ) : (
        <div>
          <div style={{ fontSize: '1.1rem', marginBottom: 8 }}>
            Idle cash:{' '}
            <b>{idleTotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</b>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0b5fff' }}>
            You’re missing ~
            {yearly.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/yr
          </div>
          {lifestyle.length > 0 && (
            <div style={{ marginTop: 8, color: '#444' }}>
              That’s like {lifestyle.slice(0, 3).join(' • ')}.
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Fix it → See Idle Cash
            </button>
          </div>

          {/* Alerts section */}
          {alerts.length > 0 && (
            <ul style={{ marginTop: 12, paddingLeft: 16, color: '#a00' }}>
              {alerts.map((a, i) => (
                <li key={i}>{a.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
