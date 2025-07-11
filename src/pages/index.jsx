import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) window.location.href = '/';
      else {
        setSession(session);
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>🔥 Welcome to RavBot Dashboard 🔥</h1>
      <p>Logged in as: {session.user.email}</p>
      <button onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
      }}>
        Logout
      </button>
    </div>
  );
}
