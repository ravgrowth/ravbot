import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import EditTransactionModal from './EditTransactionModal.jsx';

export default function Transactions({ userId, limit = 200 }) {
  const [transactions, setTransactions] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: txns } = await supabase
        .from('transactions')
        .select('transaction_id, date, merchant_name, name, amount, user_id')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      const { data: ovs } = await supabase
        .from('transaction_overrides')
        .select('transaction_id, category, notes')
        .eq('user_id', userId);

      const map = {};
      (ovs || []).forEach((o) => {
        map[o.transaction_id] = o;
      });

      setOverrides(map);
      setTransactions(txns || []);
      setLoading(false);
    };
    fetchData();
  }, [userId, limit]);

  const grouped = transactions.reduce((acc, t) => {
    const date = t.date;
    acc[date] = acc[date] || [];
    acc[date].push(t);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  const handleSave = async (transactionId, category, notes) => {
    await supabase.from('transaction_overrides').upsert(
      {
        user_id: userId,
        transaction_id: transactionId,
        category,
        notes,
      },
      { onConflict: 'user_id,transaction_id' }
    );
    setOverrides((prev) => ({ ...prev, [transactionId]: { category, notes } }));
    setEditing(null);
  };

  if (loading) return <p>Loading...</p>;
  if (transactions.length === 0) return <p>No transactions</p>;

  return (
    <div>
      {dates.map((date) => (
        <div key={date} style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0.5rem 0' }}>{date}</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {grouped[date].map((t) => {
              const override = overrides[t.transaction_id] || {};
              const amount = typeof t.amount === 'number' ? t.amount.toFixed(2) : t.amount;
              return (
                <li
                  key={t.transaction_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.25rem 0',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <div>
                    <strong>{t.merchant_name || t.name}</strong>
                    {t.merchant_name && t.name && (
                      <div style={{ fontSize: '0.8rem', color: '#555' }}>{t.name}</div>
                    )}
                    {override.category && (
                      <div style={{ fontSize: '0.8rem', color: '#555' }}>
                        Category: {override.category}
                      </div>
                    )}
                    {override.notes && (
                      <div style={{ fontSize: '0.8rem', color: '#555' }}>Notes: {override.notes}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>${amount}</div>
                    <button onClick={() => setEditing(t)}>Edit</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {editing && (
        <EditTransactionModal
          transaction={editing}
          override={overrides[editing.transaction_id]}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
