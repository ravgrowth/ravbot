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
      console.log('[BankConnections] fetchBanks start', { userId });
      const { data, error } = await supabase
        .from('bank_connections')
        .select('id, institution_name, institution_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[BankConnections] fetchBanks supabase error', error);
      }
      if (!data || data.length === 0) {
        console.error('[BankConnections] fetchBanks empty result');
      }
      setBanks(data || []);
      console.log('[BankConnections] fetchBanks done', { count: (data || []).length });
    };
    fetchBanks();
  }, [userId]);

  useEffect(() => {
    const createLinkToken = async () => {
      console.log('[BankConnections] createLinkToken start');
      const res = await fetch('/api/linkToken', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        console.error('[BankConnections] createLinkToken error', data);
      }
      setLinkToken(data.link_token);
      console.log('[BankConnections] createLinkToken done');
    };
    createLinkToken();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      console.log('[BankConnections] onSuccess start', { institution: metadata.institution });
      const bankName = metadata.institution?.name;
      const bankId = metadata.institution?.institution_id;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/exchangePublicToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ public_token, bankName, bankId, userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[BankConnections] exchangePublicToken error', data.error || data);
        alert('Failed to link bank');
        return;
      }

      // 1) Save bank connection and update UI list
      setBanks((prev) => [...prev, data.bank]);
      console.log('[BankConnections] bank linked', { bank: data.bank });

      // 2) Save bank id into state as bankConnectionId
      const newBankConnectionId = data.bank?.id;
      setBankConnectionId(newBankConnectionId);
      console.log('[BankConnections] setBankConnectionId', { bankConnectionId: newBankConnectionId });

      // 3) Immediately sync subscriptions
      try {
        console.log('[BankConnections] syncSubscriptions start', { userId, bankConnectionId: newBankConnectionId });
        const syncRes = await fetch('/api/syncSubscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({ userId, bankConnectionId: newBankConnectionId }),
        });
        const syncJson = await syncRes.json();
        if (!syncRes.ok) throw new Error(syncJson.error || 'Sync failed');
        console.log('[BankConnections] syncSubscriptions done', syncJson);

        // 4) Trigger Dashboard's loadSubs() so subscriptions refresh
        if (typeof loadSubs === 'function') {
          console.log('[BankConnections] loadSubs start');
          await loadSubs();
          console.log('[BankConnections] loadSubs done');
        }
      } catch (err) {
        console.error('[BankConnections] syncSubscriptions error', err?.stack || err);
        alert('Failed to sync subscriptions');
      }
      console.log('[BankConnections] onSuccess end');
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
