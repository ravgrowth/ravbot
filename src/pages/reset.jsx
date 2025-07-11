import { useEffect, useState } from 'react';
import { supabase } from "../supabaseClient";

export default function Reset() {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('Waiting for token...');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const access_token = url.searchParams.get('access_token');
    const refresh_token = url.searchParams.get('refresh_token');
    const type = url.searchParams.get('type');

    if (access_token && refresh_token && type === 'recovery') {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) {
          console.error("Error setting session:", error.message);
          setStatus("Could not set session");
        } else {
          supabase.auth.getUser().then(({ data, error }) => {
            if (data?.user?.email) {
              setEmail(data.user.email);
              setStatus("Enter your new password");
            } else {
              setStatus("User not found. Refresh?");
            }
          });
        }
      });
    } else {
      setStatus("Invalid or expired recovery link.");
    }
  }, []);

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setStatus(error.message);
    setStatus("Password reset! You can log in now.");
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Reset Password</h2>
      <p>{status}</p>
      {email && (
        <>
          <p>Email: {email}</p>
          <input
            type="password"
            placeholder="New password"
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button onClick={handleReset}>Set New Password</button>
        </>
      )}
    </div>
  );
}
