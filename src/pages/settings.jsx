import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "";

export default function Settings() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rent, setRent] = useState(50);
  const [essentials, setEssentials] = useState(30);
  const [lifestyle, setLifestyle] = useState(20);
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) window.location.href = "/";
      else {
        setSession(session);
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    const loadBudget = async () => {
      if (!session?.user) return;
      const { data } = await supabase
        .from('user_budgets')
        .select('rent, essentials, lifestyle, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (row) {
        setRent(Number(row.rent ?? 50));
        setEssentials(Number(row.essentials ?? 30));
        setLifestyle(Number(row.lifestyle ?? 20));
      }
    };
    loadBudget();
  }, [session?.user]);

  async function handleDelete() {
    setError("");
    if (!password) {
      setError("Enter your password.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password
    });
    if (signInError) {
      setError("Incorrect password.");
      return;
    }

    try {
      const r = await fetch(`${API_ORIGIN}/api/deleteAccount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user.id })
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error || "Failed to delete account.");
        return;
      }
    } catch (err) {
      console.error(err);
      setError("Failed to delete account.");
      return;
    }

    await supabase.auth.signOut();
    window.location.href = `/#message=${encodeURIComponent("Your account has been deleted.")}`;
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>Settings</h1>
      <div style={{ marginTop: 16, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Budget Baseline</h2>
        <p style={{ color: '#555' }}>Adjust your 50/30/20 style budget. Values are percentages.</p>
        <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
          <label>
            <div>Rent/Housing: {rent}%</div>
            <input type="range" min="0" max="100" value={rent} onChange={(e) => setRent(Number(e.target.value))} />
          </label>
          <label>
            <div>Essentials: {essentials}%</div>
            <input type="range" min="0" max="100" value={essentials} onChange={(e) => setEssentials(Number(e.target.value))} />
          </label>
          <label>
            <div>Lifestyle: {lifestyle}%</div>
            <input type="range" min="0" max="100" value={lifestyle} onChange={(e) => setLifestyle(Number(e.target.value))} />
          </label>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>Total: {rent + essentials + lifestyle}%</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                try {
                  setSavingBudget(true);
                  setError("");
                  const payload = { user_id: session.user.id, rent, essentials, lifestyle };
                  await supabase.from('user_budgets').insert(payload);
                } catch (e) {
                  setError(String(e.message || e));
                } finally {
                  setSavingBudget(false);
                }
              }}
              disabled={savingBudget}
            >
              {savingBudget ? 'Saving…' : 'Save Budget'}
            </button>
            <button onClick={() => (window.location.href = '/dashboard')}>Back to Dashboard</button>
          </div>
          {error && <div style={{ color: 'red' }}>{error}</div>}
        </div>
      </div>
      <button onClick={() => setShowModal(true)}>Delete Account</button>
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center"
          }}
        >
          <div style={{ background: "white", padding: 20, maxWidth: 400 }}>
            <p>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <input
              type="password"
              placeholder="Current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", marginTop: 8 }}
            />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleDelete}>Delete My Account</button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setPassword("");
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

