import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import HeaderBar from '../components/HeaderBar.jsx';
import Transactions from '../components/Transactions.jsx';
import BankConnections from '../components/BankConnections.jsx';
import Subscriptions from '../components/Subscriptions.jsx';
import IdleCash from '../components/IdleCash.jsx';
import GrowthGap from '../components/GrowthGap.jsx';
import DownloadCsvButton from '../components/DownloadCsvButton.jsx';
import Card from '../components/Card.jsx';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [idleV2, setIdleV2] = useState([]);

  const totalNetWorth = useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
    [accounts]
  );

  const lifetimeSaved = useMemo(
    () => idleV2.reduce((sum, r) => sum + Number(r.estimated_yearly_gain || 0), 0),
    [idleV2]
  );

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
    const fetchData = async () => {
      if (!session?.user) return;
      // Fetch accounts for the user
      const { data: acctRows, error: acctErr } = await supabase
        .from('accounts')
        .select('id, name, account_type, subtype, balance, currency, bank_connection_id')
        .eq('user_id', session.user.id);
      if (!acctErr && Array.isArray(acctRows)) {
        setAccounts(acctRows);
        const ids = acctRows.map(a => a.id);
        if (ids.length > 0) {
          const since = new Date();
          since.setDate(since.getDate() - 30);
          const { data: balRows, error: balErr } = await supabase
            .from('account_balances')
            .select('id, account_id, date, balance, pnl')
            .in('account_id', ids)
            .gte('date', since.toISOString().slice(0,10))
            .order('date', { ascending: false });
          if (!balErr && Array.isArray(balRows)) setBalances(balRows);
        }
      }

      // Fetch idle v2 for Lifetime Saved
      const { data: idleData } = await supabase
        .from('idle_cash_recommendations_v2')
        .select('balance, estimated_yearly_gain')
        .eq('user_id', session.user.id);
      setIdleV2(Array.isArray(idleData) ? idleData : []);
    };
    if (!loading) fetchData();
  }, [loading, session?.user]);

  function MiniLineChart({ points, width = 220, height = 60, stroke = '#0b5fff' }) {
    if (!points || points.length === 0) return <svg width={width} height={height} />;
    const xs = points.map((_, i) => i);
    const ys = points.map(p => Number(p.balance || 0));
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const ySpan = maxY - minY || 1;
    const stepX = points.length > 1 ? width / (points.length - 1) : width;
    const d = points
      .map((p, i) => {
        const x = i * stepX;
        const y = height - ((Number(p.balance || 0) - minY) / ySpan) * height;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <path d={d} fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  function weeklyPnl(rows) {
    if (!rows || rows.length === 0) return 0;
    const byDateDesc = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = byDateDesc[0];
    const targetDate = new Date(latest.date);
    targetDate.setDate(targetDate.getDate() - 7);
    let reference = byDateDesc.find(r => new Date(r.date) <= targetDate) || byDateDesc[byDateDesc.length - 1];
    return Number(latest.balance || 0) - Number(reference?.balance || 0);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>Welcome to RavBot Dashboard</h1>
      <p>Logged in as: {session.user.email}</p>
      <button onClick={() => (window.location.href = '/settings')}>Settings</button>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = '/login';
        }}
      >
        Log Out
      </button>

      <div style={{ padding: '1rem' }}>
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          border: '1px solid #eee',
          borderRadius: 8,
          background: '#fafafa'
        }}>
          <h2 style={{ margin: 0 }}>
            Total Net Worth: ${totalNetWorth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </h2>
        </div>
        <HeaderBar user={session.user} />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Card
              title="Transactions"
              actions={<DownloadCsvButton userId={session.user.id} />}
            >
              <Transactions userId={session.user.id} limit={200} />
            </Card>
          </div>
          <div style={{ flex: 1, display: 'grid', gap: '1rem' }}>
            <Card title="Accounts">
              {accounts.length === 0 ? (
                <p>No accounts yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  {accounts.map((a) => {
                    const series = balances
                      .filter(b => b.account_id === a.id)
                      .sort((x, y) => new Date(x.date) - new Date(y.date));
                    const pnl7 = weeklyPnl(series);
                    return (
                      <div key={a.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{a.name}</div>
                            <div style={{ fontSize: '0.85rem', color: '#555' }}>{a.account_type}{a.subtype ? ` · ${a.subtype}` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700 }}>
                              {Number(a.balance || 0).toLocaleString(undefined, { style: 'currency', currency: a.currency || 'USD' })}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: pnl7 >= 0 ? '#0a8' : '#d33' }}>
                              {pnl7 >= 0 ? '+' : ''}{pnl7.toLocaleString(undefined, { style: 'currency', currency: a.currency || 'USD' })} this week
                            </div>
                          </div>
                        </div>
                        <MiniLineChart points={series} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <BankConnections userId={session.user.id} />
            <IdleCash userId={session.user.id} />
            <GrowthGap userId={session.user.id} />
            <Card title="Dopamine">
              <div style={{ fontSize: '1.1rem' }}>
                Lifetime Saved: {lifetimeSaved.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </div>
            </Card>
            <Subscriptions userId={session.user.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
