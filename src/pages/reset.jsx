import { useEffect, useState } from 'react';
import { supabase } from "../supabaseClient";

export default function Reset() {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('Waiting for token...');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('RAW LOCATION:', window.location.href);
    console.log('HASH:', window.location.hash);
    
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);

    const access_token = searchParams.get("access_token") || hashParams.get("access_token");
    const refresh_token = searchParams.get("refresh_token") || hashParams.get("refresh_token");
    const type = searchParams.get("type") || hashParams.get("type");

    console.log("Parsed Params:", { access_token, refresh_token, type });

    if (access_token) {
      supabase.auth.setSession({ access_token, refresh_token: refresh_token || '' })
        .then(({ data, error }) => {
          setLoading(false);
          if (error) {
            console.error("Error setting session:", error);
          } else {
            console.log("Session set:", data);
            supabase.auth.getUser().then(({ data: userData }) => {
              if (userData?.user?.email) setEmail(userData.user.email);
            });
          }
        });
    } else {
      console.error("Missing or invalid token");
      setLoading(false);
    }
  }, []);

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setStatus(error.message);
    setStatus("Password reset! You can log in now.");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Reset Password</h1>
      {loading ? (
        <p style={{ color: "cyan" }}>Waiting for token...</p>
      ) : (
        <>
          <p>{status || "Token handled."}</p>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button onClick={handleReset}>Set New Password</button>
        </>
      )}
    </div>
  );
}
