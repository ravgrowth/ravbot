import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

function formatTimestamp(isoString) {
  try {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  } catch (err) {
    console.warn('[Goals] formatTimestamp failed', err);
    return '';
  }
}

export default function Goals() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goalType, setGoalType] = useState('vacation');
  const [carrot, setCarrot] = useState('');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }
      setSession(session);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const loadGoal = async () => {
      if (!session?.user?.id) return;
      try {
        const { data, error: queryError } = await supabase
          .from('user_goals')
          .select('goal_type, carrot, target, updated_at, created_at')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (queryError) throw queryError;
        if (Array.isArray(data) && data.length > 0) {
          const row = data[0];
          setGoalType(row.goal_type || 'vacation');
          setCarrot(row.carrot || '');
          setTarget(row.target ? String(row.target) : '');
          setSavedAt(formatTimestamp(row.updated_at || row.created_at));
        }
      } catch (err) {
        console.error('[Goals] loadGoal error', err);
        setError(err?.message || 'Failed to load goal');
      }
    };
    loadGoal();
  }, [session?.user?.id]);

  if (loading) return <p>Loading...</p>;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    try {
      setSaving(true);
      setError('');
      const userId = session.user.id;
      const payload = {
        user_id: userId,
        goal_type: goalType,
        carrot: carrot.trim() || null,
        target: target ? Number(target) : null,
        updated_at: new Date().toISOString(),
      };
      const { data, error: upsertError } = await supabase
        .from('user_goals')
        .upsert(payload, { onConflict: 'user_id' })
        .select('goal_type, carrot, target, updated_at')
        .single();
      if (upsertError) throw upsertError;
      setGoalType(data.goal_type || goalType);
      setCarrot(data.carrot || '');
      setTarget(data.target ? String(data.target) : '');
      const timestamp = data.updated_at || payload.updated_at;
      setSavedAt(formatTimestamp(timestamp));
    } catch (err) {
      setError(err?.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      <h1>Set a Goal</h1>
      <p style={{ color: '#555' }}>Pick a goal and a carrot to keep you motivated.</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ marginBottom: 4 }}>Goal Type</div>
          <select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
            <option value="vacation">Vacation</option>
            <option value="debt">Pay off Debt</option>
            <option value="retirement">Retirement</option>
            <option value="emergency">Emergency Fund</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <div style={{ marginBottom: 4 }}>Carrot (what keeps you motivated?)</div>
          <input value={carrot} onChange={(e) => setCarrot(e.target.value)} placeholder="PS5, Cancun, new guitar" />
        </label>
        <label>
          <div style={{ marginBottom: 4 }}>Target Amount (USD)</div>
          <input
            type="number"
            min="0"
            step="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="5000"
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Goal'}</button>
          <button type="button" onClick={() => (window.location.href = '/dashboard')}>
            Cancel
          </button>
        </div>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {savedAt && !error && (
          <div style={{ color: '#0a8' }}>Saved at {savedAt}</div>
        )}
      </form>
    </div>
  );
}
