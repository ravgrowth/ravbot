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

  useEffect(() => {
    const fetchSubs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('subscriptions')
        .select('id, name, status')
        .eq('user_id', userId);
      setSubs(data || []);
      setLoading(false);
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
              <span>{s.name}</span>
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
    </Card>
  );
}
