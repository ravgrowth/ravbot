import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Card from './Card.jsx';

const labels = {
  detected: 'Detected',
  cancel_pending: 'Cancel Pending',
  cancelled: 'Cancelled',
};

export default function Subscriptions({ userId }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState({ data: null, error: null });

  const fetchSubs = async () => {
    try {
      setLoading(true);
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
    } catch (e) {
      console.error('[Subscriptions] list error', e);
      setDebug({ data: null, error: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, [userId]);

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
    <Card title="Subscriptions">
      {loading ? (
        <p>Loading...</p>
      ) : subs.length === 0 ? (
        <p>No subscriptions found</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {subs.map((s) => (
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
      <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#fafafa', border: '1px dashed #ddd', borderRadius: 6 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Debug</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.85rem' }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>
    </Card>
  );
}
