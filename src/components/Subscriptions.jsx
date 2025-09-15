import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';
import { log, logError } from '../utils/log.js';

const labels = {
  detected: 'Detected',
  cancel_pending: 'Cancel Pending',
  cancelled: 'Cancelled',
};

export default function Subscriptions({ userId }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState({ data: null, error: null });
  const [showCanceled, setShowCanceled] = useState(false);
  const [sortBy, setSortBy] = useState('price'); // price | date
  const [expandAll, setExpandAll] = useState(false);

  const fetchSubs = async () => {
    try {
      setLoading(true);
      log('[Subscriptions]', 'fetch start', { userId })
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch('/api/subscriptions/list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load subscriptions');
      setSubs(json.subscriptions || []);
      setDebug({ data: json, error: null });
      log('[Subscriptions]', 'fetch ok', { count: (json.subscriptions||[]).length })
    } catch (e) {
      logError('[Subscriptions]', e)
      setDebug({ data: null, error: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, [userId]);

  const filtered = useMemo(() => {
    let rows = (subs || []).filter(s => s && s.merchant_name)
    if (!showCanceled) rows = rows.filter(s => String(s.status||'').toLowerCase() !== 'cancelled')
    if (sortBy === 'price') rows = rows.slice().sort((a,b)=>Number(b.amount||0)-Number(a.amount||0))
    return rows
  }, [subs, showCanceled, sortBy])

  const cancelLinks = (merchant) => {
    const name = (merchant || '').toLowerCase();
    const known = {
      'spotify': 'https://support.spotify.com/us/article/cancel-premium/',
      'netflix': 'https://www.netflix.com/cancelplan',
      'hulu': 'https://help.hulu.com/s/article/how-to-cancel',
      'amazon prime': 'https://www.amazon.com/gp/primecentral',
      'apple': 'https://support.apple.com/en-us/HT202039',
      'google': 'https://play.google.com/store/account/subscriptions',
      'uber': 'https://help.uber.com',
      'uber eats': 'https://help.uber.com/ubereats',
      'xfinity': 'https://www.xfinity.com/support/articles/cancel-services',
      'att': 'https://www.att.com/support/article/my-account/KM1045265/',
    };
    for (const key of Object.keys(known)) {
      if (name.includes(key)) return known[key];
    }
    const q = encodeURIComponent(`${merchant} cancel subscription`);
    return `https://www.google.com/search?q=${q}`;
  };

  return (
    <Card title="Subscriptions" actions={
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <label style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
          <input type="checkbox" checked={showCanceled} onChange={e=>setShowCanceled(e.target.checked)} /> Show canceled
        </label>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="price">Sort by price</option>
          <option value="date">Sort by date</option>
        </select>
        <button onClick={()=>setExpandAll(v=>!v)}>{expandAll? 'Collapse all':'Expand all'}</button>
      </div>
    }>
      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <p>No subscriptions found</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {filtered.map((s) => (
            <li
              key={s.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.25rem 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <span>
                <strong>{s.merchant_name}</strong>
                <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.85rem' }}>
                  {s.amount != null ? `$${Number(s.amount).toFixed(2)}` : ''}
                  {s.interval ? ` / ${s.interval}` : ''}
                </span>
                {expandAll && (
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Status: {s.status || 'unknown'}
                  </div>
                )}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  background: '#eee',
                  borderRadius: '4px',
                  padding: '0 0.5rem',
                }}
              >
                {labels[s.status] || s.status}
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    const url = cancelLinks(s.merchant_name || '');
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  title="Open the merchant's cancellation page"
                >
                  Cancel
                </button>
             </span>
           </li>
         ))}
       </ul>
     )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={async ()=>{
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/dev/insertTestData', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ userId: session?.user?.id }) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed')
            await fetchSubs()
          } catch (e) {
            logError('[Subscriptions]', e)
          }
        }}>Insert test values</button>
      </div>
      <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#fafafa', border: '1px dashed #ddd', borderRadius: 6 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Debug</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.85rem' }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>
    </Card>
  );
}
