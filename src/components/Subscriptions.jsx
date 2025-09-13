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

  useEffect(() => {
    const fetchSubs = async () => {
      console.log('[Subscriptions] fetchSubs start', { userId });
      setLoading(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, merchant_name, status')
        .eq('user_id', userId);
      if (error) {
        console.error('[Subscriptions] fetchSubs supabase error', error);
      }
      if (!data || data.length === 0) {
        console.error('[Subscriptions] fetchSubs empty result');
      }
      setSubs(data || []);
      setDebug({ data: data || null, error: error || null });
      setLoading(false);
      console.log('[Subscriptions] fetchSubs done', { count: (data || []).length });
    };
    fetchSubs();
  }, [userId]);

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
                {s.merchant_name}
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
