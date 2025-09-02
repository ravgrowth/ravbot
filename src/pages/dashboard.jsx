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

  if (loading) return <p>Loading...</p>;

  return (
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
