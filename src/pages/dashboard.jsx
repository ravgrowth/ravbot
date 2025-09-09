import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import HeaderBar from '../components/HeaderBar.jsx';
import Transactions from '../components/Transactions.jsx';
import BankConnections from '../components/BankConnections.jsx';
import Subscriptions from '../components/Subscriptions.jsx';
import DownloadCsvButton from '../components/DownloadCsvButton.jsx';
import Card from '../components/Card.jsx';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/';
      } else {
        setSession(session);
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('subscriptions').select('*');
      setSubs(data || []);
    };
    if (session) load();
  }, [session]);

  const handleCancel = async (id) => {
    const prev = subs.find((s) => s.id === id)?.status;
    setSubs((s) => s.map((sub) => sub.id === id ? { ...sub, status: 'cancel_pending' } : sub));
    try {
      const res = await fetch('/api/cancelSubscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscriptionId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setSubs((s) => s.map((sub) => sub.id === id ? { ...sub, status: json.status } : sub));
    } catch (err) {
      console.error(err);
      alert('Cancel failed');
      setSubs((s) => s.map((sub) => sub.id === id ? { ...sub, status: prev } : sub));
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>🔥 Welcome to RavBot Dashboard 🔥</h1>
      <p>Logged in as: {session.user.email}</p>
      <button onClick={() => (window.location.href = "/settings")}>Settings</button>
      <button onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}>
        Log Out
      </button>

      <h2 style={{ marginTop: 30 }}>Subscriptions</h2>
      <ul>
        {subs.map((sub) => (
          <li key={sub.id} style={{ marginBottom: 10 }}>
            {sub.merchant_name} - {sub.status}
            {sub.status !== 'cancelled' && (
              <button
                onClick={() => handleCancel(sub.id)}
                disabled={sub.status === 'cancel_pending'}
                style={{ marginLeft: 10 }}
              >
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
    <div style={{ padding: '1rem' }}>
      <HeaderBar user={session.user} />
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Card title="Transactions" actions={<DownloadCsvButton userId={session.user.id} />}>
            <Transactions userId={session.user.id} limit={200} />
          </Card>
        </div>
        <div style={{ flex: 1 }}>
          <BankConnections userId={session.user.id} />
          <Subscriptions userId={session.user.id} />
        </div>
      </div>
    </div>
  );
}
