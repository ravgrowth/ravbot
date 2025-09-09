import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { usePlaidLink } from 'react-plaid-link';
import Card from './Card.jsx';

export default function BankConnections({ userId, loadSubs }) {
  const [linkToken, setLinkToken] = useState(null);
  const [banks, setBanks] = useState([]);
  const [bankConnectionId, setBankConnectionId] = useState(null);

  useEffect(() => {
    const fetchBanks = async () => {
      const { data } = await supabase
        .from('bank_connections')
        .select('id, institution_name, institution_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setBanks(data || []);
    };
    fetchBanks();
  }, [userId]);

  useEffect(() => {
    const createLinkToken = async () => {
      const res = await fetch('/api/linkToken', { method: 'POST' });
      const data = await res.json();
      setLinkToken(data.link_token);
    };
    createLinkToken();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      const bankName = metadata.institution?.name;
      const bankId = metadata.institution?.institution_id;
      const res = await fetch('/api/exchangePublicToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token, bankName, bankId, userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(data.error);
        alert('Failed to link bank');
        return;
      }

      // 1) Save bank connection and update UI list
      setBanks((prev) => [...prev, data.bank]);

      // 2) Save bank id into state as bankConnectionId
      const newBankConnectionId = data.bank?.id;
      setBankConnectionId(newBankConnectionId);

      // 3) Immediately sync subscriptions
      try {
        const syncRes = await fetch('/api/syncSubscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, bankConnectionId: newBankConnectionId }),
        });
        const syncJson = await syncRes.json();
        if (!syncRes.ok) throw new Error(syncJson.error || 'Sync failed');

        // 4) Trigger Dashboard's loadSubs() so subscriptions refresh
        if (typeof loadSubs === 'function') {
          await loadSubs();
        }
      } catch (err) {
        console.error(err);
        alert('Failed to sync subscriptions');
      }
    },
  });

  return (
    <Card
      title="Bank Connections"
      actions={
        <button onClick={() => open()} disabled={!ready || !linkToken}>
          Connect Bank
        </button>
      }
    >
      {banks.length === 0 ? (
        <p>No banks connected</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {banks.map((b) => (
            <li key={b.id}>{b.institution_name}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
