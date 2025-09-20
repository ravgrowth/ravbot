import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import HeaderBar from '../components/HeaderBar.jsx';
import Transactions from '../components/Transactions.jsx';
import BankConnections from '../components/BankConnections.jsx';
import Subscriptions from '../components/Subscriptions.jsx';
import IdleCash from '../components/IdleCash.jsx';
import GrowthGap from '../components/GrowthGap.jsx';
import BudgetSummary from '../components/BudgetSummary.jsx';
import DownloadCsvButton from '../components/DownloadCsvButton.jsx';
import Card from '../components/Card.jsx';
import MoneyScore from '../components/MoneyScore.jsx';
import RecentLogs from '../components/RecentLogs.jsx';
import { log } from '../utils/log.js';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [idleV2, setIdleV2] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [goal, setGoal] = useState(null);
  const [lifetimeSavedDb, setLifetimeSavedDb] = useState(null);
  const [showSubs, setShowSubs] = useState(true);
  const [showIdle, setShowIdle] = useState(true);
  const [showGrowth, setShowGrowth] = useState(true);
  const [showBudget, setShowBudget] = useState(true);

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
      log('[Dashboard]', 'fetchData start', { userId: session.user.id });
      // Fetch accounts for the user
      const { data: acctRows, error: acctErr } = await supabase
        .from('accounts')
        .select('user_id, id, name, account_type, subtype, balance, currency, bank_connection_id')
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
        .select('user_id, balance, estimated_yearly_gain')
        .eq('user_id', session.user.id);
      setIdleV2(Array.isArray(idleData) ? idleData : []);

      // Fetch latest user goal
      const { data: goals } = await supabase
        .from('user_goals')
        .select('user_id, goal_type, carrot, target, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      setGoal(Array.isArray(goals) && goals.length > 0 ? goals[0] : null);

      // Fetch lifetime savings aggregate
      try {
        const { data: lsRow } = await supabase
          .from('lifetime_savings')
          .select('user_id, saved_amount')
          .eq('user_id', session.user.id)
          .limit(1)
          .single();
        if (lsRow && typeof lsRow.saved_amount !== 'undefined') {
          setLifetimeSavedDb(Number(lsRow.saved_amount) || 0);
        }
      } catch (_) {
        // ignore if not present yet
      }
      log('[Dashboard]', 'fetchData done');
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
      <div style={{
        margin: '12px 0',
        padding: '16px 18px',
        borderRadius: 10,
        background: 'linear-gradient(90deg, #e6f0ff, #f0f7ff)',
        border: '1px solid #d9e6ff',
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0b5fff' }}>
          {(() => {
            const total = (lifetimeSavedDb ?? lifetimeSaved) || 0;
            return `RavBot saved you ${total.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} so far.`;
          })()}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#456' }}>Keep scanning to find more savings.</div>
      </div>
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
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={async () => {
                try {
                  setScanError('');
                  setScanning(true);
                  setScanResult(null);
                  const { data: { session: sess } } = await supabase.auth.getSession();
                  const token = sess?.access_token;
                  const resp = await fetch('/api/scanMoney', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  });
                  if (!resp.ok) throw new Error('Scan failed');
                  const json = await resp.json();
                  setScanResult(json);
                } catch (e) {
                  setScanError(String(e.message || e));
                } finally {
                  setScanning(false);
                }
              }}
              disabled={scanning}
            >
              {scanning ? 'Scanning…' : 'Scan My Money'}
            </button>
            <button onClick={() => (window.location.href = '/goals')}>Set a Goal</button>
          </div>
          {scanError && (
            <div style={{ color: 'red', marginTop: 8 }}>{scanError}</div>
          )}
          {scanResult && (
            <div style={{
              marginTop: 12,
              padding: '12px 14px',
              border: '1px solid #e6e6e6',
              borderRadius: 8,
              background: '#fff',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Scan Summary</div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div>
                  {`${(scanResult.leaks || []).length} leaks found 	→ ${Number(scanResult?.totals?.leaks_yearly || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/year lost.`}
                </div>
                <div>
                  {`Idle ${Number((scanResult.idle_cash || []).reduce((a, r) => a + Number(r.amount || 0), 0)).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} 	→ missing ${Number(scanResult?.totals?.idle_yearly || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} this year.`}
                </div>
                <div>
                  {(() => {
                    const g = (scanResult.growth || [])[0] || {};
                    const rate = g?.missing_rate != null ? `${Math.round(Number(g.missing_rate) * 100)}%` : null;
                    const label = g?.message || 'Growth gap';
                    return rate
                      ? `${label} 	→ missing ${rate} growth.`
                      : `${label}.`;
                  })()}
                </div>
              </div>
              {(() => {
                const leaksYearly = Number(scanResult?.totals?.leaks_yearly || 0);
                if (!goal || !goal.carrot || !goal.target || leaksYearly <= 0) return null;
                const monthlySavings = leaksYearly / 12;
                if (monthlySavings <= 0) return null;
                const months = Math.max(1, Math.ceil(Number(goal.target) / monthlySavings));
                const topLeak = (scanResult.leaks || []).slice().sort((a, b) => (b.yearly_amount || 0) - (a.yearly_amount || 0))[0];
                const who = topLeak?.merchant || 'subscriptions';
                return (
                  <div style={{ marginTop: 6, color: '#0b5fff' }}>
                    {`Cancel ${who} = ${goal.carrot} in ${months} months.`}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        <HeaderBar user={session.user} />
        <div style={{ margin: '8px 0' }}>
          <MoneyScore userId={session.user.id} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', maxWidth: 1400, margin: '0 auto' }}>
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
                <div>
                  <p>No accounts yet. Connect a bank?</p>
                  <BankConnections userId={session.user.id} />
                </div>
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
            <BudgetSummary userId={session.user.id} />
            <Card title="Dopamine">
              <div style={{ fontSize: '1.1rem' }}>
                Lifetime Saved: {lifetimeSaved.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </div>
            </Card>
            {!showSubs ? (
              <Card title="Subscriptions" actions={<button onClick={() => setShowSubs(true)}>Open</button>}>
                <p>Hidden until opened to optimize load.</p>
              </Card>
            ) : (
              <Subscriptions userId={session.user.id} />
            )}
            <RecentLogs />
            <Card title="Developer / Test">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={async () => {
                  log('[DevBtn]', 'insertTestData clicked')
                  const { data: { session } } = await supabase.auth.getSession()
                  const res = await fetch('/api/dev/insertTestData', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: session?.user?.id }) })
                  const json = await res.json()
                  alert(res.ok ? `Inserted: ${json.inserted}` : `Error: ${json.error}`)
                }}>Insert test values</button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
