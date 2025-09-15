import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function Goals() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goalType, setGoalType] = useState('vacation');
  const [carrot, setCarrot] = useState('');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  if (loading) return <p>Loading...</p>;

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      const userId = session.user.id;
      const payload = {
        user_id: userId,
        goal_type: goalType,
        carrot: carrot || null,
        target: target ? Number(target) : null,
      };
      const { error } = await supabase.from('user_goals').insert(payload);
      if (error) throw error;
      window.location.href = '/dashboard#message=' + encodeURIComponent('Goal saved!');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      <h1>Set a Goal</h1>
      <p style={{ color: '#555' }}>Pick a goal and a fun carrot to keep you motivated.</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ marginBottom: 4 }}>Goal Type</div>
          <select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
            <option value="vacation">Vacation</option>
            <option value="debt">Pay off Debt</option>
            <option value="retirement">Retirement</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <div style={{ marginBottom: 4 }}>Carrot (e.g., PS5, Cancun)</div>
          <input value={carrot} onChange={(e) => setCarrot(e.target.value)} placeholder="PS5, Cancun, New iPad" />
        </label>
        <label>
          <div style={{ marginBottom: 4 }}>Target Amount (USD)</div>
          <input type="number" min="0" step="1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="500" />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Goal'}</button>
          <button type="button" onClick={() => (window.location.href = '/dashboard')}>Cancel</button>
        </div>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </form>
    </div>
  );
}

