import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "";

export default function Settings() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

