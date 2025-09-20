import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { log, logError } from '../utils/log.js';

const usd = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function gradeForTotal(total) {
  if (total >= 50000) return { grade: 'A', note: 'Great cushion. Keep compounding.' };
  if (total >= 10000) return { grade: 'B', note: 'Solid footing. Consider investing surplus.' };
  if (total >= 1000) return { grade: 'C', note: 'Off to a strong start. Keep adding to reserves.' };
  if (total >= 100) return { grade: 'D', note: 'Build a bigger safety net to move up.' };
  return { grade: 'F', note: 'Link accounts and stash your first $100.' };
}

export default function MoneyScore({ userId }) {
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redact, setRedact] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      setError('');
      try {
        log('[MoneyScore]', 'load start', { userId });
        const { data: accounts, error: accountsError } = await supabase
          .from('accounts')
          .select('id, balance')
          .eq('user_id', userId);
        if (accountsError) throw accountsError;

        const accountIds = (accounts || []).map((row) => row.id).filter(Boolean);
        let total = 0;
        if (accountIds.length > 0) {
          const { data: balanceRows, error: balancesError } = await supabase
            .from('account_balances')
            .select('account_id, balance, date')
            .in('account_id', accountIds);
          if (balancesError) throw balancesError;

          if (Array.isArray(balanceRows) && balanceRows.length > 0) {
            const latestByAccount = new Map();
            for (const row of balanceRows) {
              const id = row.account_id;
              if (!id) continue;
              const timestamp = row.date ? new Date(row.date).getTime() : 0;
              const prev = latestByAccount.get(id);
              if (!prev || timestamp >= prev.timestamp) {
                const numericBalance = Number(row.balance || 0) || 0;
                latestByAccount.set(id, { balance: numericBalance, timestamp });
              }
            }
            total = Array.from(latestByAccount.values()).reduce((sum, item) => sum + item.balance, 0);
          } else {
            total = (accounts || []).reduce((sum, row) => sum + Number(row.balance || 0), 0);
          }
        }
        setTotalBalance(total);
        log('[MoneyScore]', 'load done', { userId, total });
      } catch (err) {
        logError('[MoneyScore]', err, { userId });
        setError(err?.message || 'Unable to compute Money Score');
        setTotalBalance(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const summary = useMemo(() => gradeForTotal(totalBalance), [totalBalance]);
  const displayNetWorth = redact ? '*****' : usd.format(totalBalance);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Money Score:</div>
      {loading ? (
        <span>Loading...</span>
      ) : error ? (
        <span style={{ color: 'red' }}>{error}</span>
      ) : (
        <>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{summary.grade}</span>
          <span style={{ color: '#666', marginLeft: 6 }}>{summary.note}</span>
          <span style={{ marginLeft: 12 }}>Net Worth:</span>
          <span style={{ fontWeight: 700 }}>{displayNetWorth}</span>
          <button style={{ marginLeft: 8 }} onClick={() => setRedact(!redact)}>
            {redact ? 'Unhide' : 'Hide'}
          </button>
        </>
      )}
    </div>
  );
}
