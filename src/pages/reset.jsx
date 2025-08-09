import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

if (typeof window !== "undefined" && window.location.hash.startsWith("#access_token")) {
  const url = window.location.href.replace("#", "?");
  window.location.replace(url);
}

export default function Reset() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("Waiting for token…");
  const [newPw, setNewPw] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const hash  = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);

    const access  = query.get("access_token")  || hash.get("access_token");
    const refresh = query.get("refresh_token") || hash.get("refresh_token");
    const type    = query.get("type")          || hash.get("type");

    if (!access) {
      setMsg("Invalid or expired link. Ask for a new one.");
      setLoading(false);
      return;
    }

    supabase.auth
      .setSession({ access_token: access, refresh_token: refresh ?? "" })
      .then(async ({ error }) => {
        setLoading(false);
        if (error) {
          setMsg(error.message);
        } else {
          setMsg("Token handled, set your new password 👇");
          const { data: { user } } = await supabase.auth.getUser();
          setUserEmail(user?.email || "");
        }
      });
  }, []);

  async function handleSave() {
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("🎉 Password reset! You can log in now.");

    // Sign out locally and send them to Login, prefilling email
    await supabase.auth.signOut();
    const next = "/login#message=" + encodeURIComponent("Password reset! Please log in.") +
                 (userEmail ? "&email=" + encodeURIComponent(userEmail) : "");
    setTimeout(() => (window.location.href = next), 600);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Reset Password</h1>

      {loading ? (
        <p style={{ color: "cyan" }}>{msg}</p>
      ) : (
        <>
          <p>{msg}</p>
          {userEmail && (
            <p style={{ marginTop: 0 }}>
              Resetting password for <b>{userEmail}</b>
            </p>
          )}
          <input
            type="password"
            placeholder="New password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
          />
          <button onClick={handleSave}>Save new password</button>
        </>
      )}

      <div style={{ marginTop: 30 }}>
        <button
          onClick={() => (window.location.href = "/login")}
          style={{
            backgroundColor: "#007aff",
            color: "white",
            padding: "10px 20px",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "1rem",
            cursor: "pointer"
          }}
        >
          Go back to Login
        </button>
      </div>
    </div>
  );
}
