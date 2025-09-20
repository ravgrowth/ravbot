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
  const [openInstructionsKey, setOpenInstructionsKey] = useState(null);

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
    // Deduplicate by normalized merchant name
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const map = new Map();
    for (const s of subs || []) {
      if (!s || !s.merchant_name) continue;
      const key = norm(s.merchant_name);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...s, _group_count: 1, _group_key: key, _earliest: s.updated_at || null });
      } else {
        const earliest = prev._earliest && s.updated_at ? (new Date(prev._earliest) < new Date(s.updated_at) ? prev._earliest : s.updated_at) : (prev._earliest || s.updated_at || null);
        map.set(key, {
          ...prev,
          amount: Math.max(Number(prev.amount || 0), Number(s.amount || 0)),
          status: prev.status === 'cancelled' ? s.status : prev.status, // keep non-cancelled if present
          _group_count: prev._group_count + 1,
          _earliest: earliest,
        });
      }
    }
    let rows = Array.from(map.values());
    if (!showCanceled) rows = rows.filter(s => String(s.status||'').toLowerCase() !== 'cancelled')
    if (sortBy === 'price') rows = rows.slice().sort((a,b)=>Number(b.amount||0)-Number(a.amount||0))
    if (sortBy === 'date') rows = rows.slice().sort((a,b)=>new Date(b._earliest||0)-new Date(a._earliest||0))
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

  const cancelInstructions = (merchant) => {
    const m = (merchant||'').toLowerCase();
    if (m.includes('spotify')) return [
      'Open spotify.com/account.',
      'Log in and go to Account > Plan.',
      'Click Change plan > Cancel Premium.',
    ];
    if (m.includes('netflix')) return [
      'Visit netflix.com/cancelplan.',
      'Confirm cancellation and note end-of-cycle date.',
    ];
    if (m.includes('hulu')) return [
      'Go to help.hulu.com and sign in.',
      'Select Manage Plan > Cancel.',
    ];
    if (m.includes('amazon') || m.includes('prime')) return [
      'Visit amazon.com/gp/primecentral.',
      'Manage Membership > End Membership.',
    ];
    if (m.includes('apple')) return [
      'On iPhone: Settings > Apple ID > Subscriptions.',
      'Select subscription > Cancel.',
    ];
    if (m.includes('google')) return [
      'Go to play.google.com > Payments & subscriptions.',
      'Select subscription > Cancel.',
    ];
    return [
      'Find your most recent receipt or emails from the merchant.',
      'Log into your account on the merchant’s website.',
      'Look for Billing/Subscriptions and choose Cancel.',
      'If you can’t find a path, contact your bank to block future charges.',
    ];
  }

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
                {s._group_count > 1 && (
                  <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#999' }}>
                    {`(${s._group_count} duplicates)`}
                  </span>
                )}
                {s._earliest && (
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    First seen: {new Date(s._earliest).toLocaleDateString()}
                  </div>
                )}
                {expandAll && (
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Status: {s.status || 'unknown'}
                  </div>
                )}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  background: (s.status==='cancel_pending') ? '#fff3cd' : (s.status==='cancelled' ? '#e6f4ea' : '#eee'),
                  borderRadius: '4px',
                  padding: '0 0.5rem',
                }}
              >
                {labels[s.status] || s.status}
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => setOpenInstructionsKey(k=>k===s._group_key?null:s._group_key)}
                  title="Show cancellation steps"
                >
                  Cancel
                </button>
             </span>
           </li>
         ))}
       </ul>
     )}
      {filtered.map((s)=> (
        s && openInstructionsKey===s._group_key ? (
          <div key={`${s._group_key}-inst`} style={{ margin: '8px 0', padding: '8px 10px', border: '1px solid #eee', borderRadius: 6, background: '#fafafa' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>How to cancel {s.merchant_name}</div>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {cancelInstructions(s.merchant_name).map((line, i)=> (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => window.open(cancelLinks(s.merchant_name||''), '_blank', 'noopener,noreferrer')}>Open steps</button>
              <button onClick={() => setOpenInstructionsKey(null)}>Close</button>
            </div>
          </div>
        ) : null
      ))}
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
