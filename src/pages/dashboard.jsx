import { useEffect, useState } from 'react';
import { supabase } from "../supabaseClient";

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) window.location.href = '/';
      else {
        setSession(session);
        setLoading(false);
        try {
          const res = await fetch('/api/subscriptions/scan');
          const data = await res.json();
          setSubs(data.subscriptions || []);
        } catch (e) {
          console.error('scan failed', e);
        }
      }
    };
    checkSession();
  }, []);

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
      <h2>Subscriptions</h2>
      {subs.length === 0 && <p>No subscriptions</p>}
      <ul>
        {subs.map((s) => (
          <li key={s.id}>
            {s.name} {s.status === 'cancelled' ? '(Cancelled)' : <button onClick={async () => {
              try {
                const res = await fetch('/api/subscriptions/cancel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subscriptionId: s.id })
                });
                if (!res.ok) throw new Error('Request failed');
                setSubs(prev => prev.filter(x => x.id !== s.id));
              } catch (err) {
                console.error(err);
                alert('Failed to cancel');
              }
            }}>Cancel</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
