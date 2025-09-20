import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';

const HYSA_URL = 'https://www.ally.com/bank/online-savings-account/';
const usd = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

function pickAccountName(row) {
  return (
    row.account_name ||
    row.platform ||
    row.institution_name ||
    row.bank_name ||
    row.account_id ||
    'Account'
  );
}

function pickTarget(row) {
  return (
    row.target_account ||
    row.suggested_target ||
    row.recommendation ||
    'High-yield savings account (HYSA)'
  );
}

export default function IdleCash({ userId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setRecommendations([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data, error: queryError } = await supabase
          .from('idle_cash_recommendations_v2')
          .select('*')
          .eq('user_id', userId)
          .order('balance', { ascending: false });
        if (queryError) throw queryError;
        if (!cancelled) setRecommendations(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          console.error('[IdleCash] load error', err);
          setError(err?.message || 'Failed to load idle cash recommendations');
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totals = useMemo(() => {
    const totalBalance = recommendations.reduce((sum, row) => sum + Number(row?.balance || 0), 0);
    const totalGain = recommendations.reduce((sum, row) => sum + Number(row?.estimated_yearly_gain || 0), 0);
    return { totalBalance, totalGain };
  }, [recommendations]);

  const openSavingsLink = (targetLabel) => {
    const query = targetLabel ? encodeURIComponent(targetLabel) : 'best high yield savings account';
    const url = `${HYSA_URL}?utm_source=ravbot&utm_medium=idle_cash&search=${query}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const titleSuffix = totals.totalBalance ? ` ${usd.format(totals.totalBalance)} idle` : '';

  return (
    <Card title={`Idle Cash${titleSuffix}`.trim()}>
      {loading ? (
        <p>Loading idle cash...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : recommendations.length === 0 ? (
        <p>No idle cash detected. Keep money working.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#333' }}>
            Estimated yearly boost: <strong>{usd.format(totals.totalGain)}</strong>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendations.map((row, idx) => {
              const accountName = pickAccountName(row);
              const balance = usd.format(Number(row.balance || 0));
              const gain = usd.format(Number(row.estimated_yearly_gain || 0));
              const target = pickTarget(row);
              const apy = row.est_apy ? `${(Number(row.est_apy) * 100).toFixed(1)}% APY` : null;
              const platform = row.platform ? `via ${row.platform}` : '';
              const id = row.id || `${accountName}-${idx}`;
              return (
                <li
                  key={id}
                  style={{
                    border: '1px solid #e0e4f0',
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {accountName}
                      {platform ? <span style={{ marginLeft: 6, fontSize: '0.85rem', color: '#777' }}>{platform}</span> : null}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#555', marginTop: 4 }}>
                      Balance {balance} | Est. gain {gain}/yr
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
                      Move funds to {target}{apy ? ` (${apy})` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <button onClick={() => openSavingsLink(target)}>Move Money</button>
                    <a
                      href={HYSA_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: '#0b5fff' }}
                    >
                      View HYSA options
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
