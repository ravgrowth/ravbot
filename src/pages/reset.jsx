import { useEffect, useState } from 'react';
import { supabase } from "../supabaseClient";

export default function Reset() {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('Waiting for token...');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      const hash = window.location.hash;
      const isRecovery = hash.includes("access_token") && hash.includes("type=recovery");

      console.log("URL:", window.location.href);
      console.log("Hash:", hash);

      if (!isRecovery) {
        setStatus("Invalid recovery link");
        return;
      }

      // Give Supabase time to auto-login
      supabase.auth.getUser().then(({ data, error }) => {
        if (data?.user?.email) {
          setEmail(data.user.email);
          setStatus("Enter your new password");
        } else {
          console.log("Supabase getUser error:", error);
          setStatus("Could not load user. Please refresh after a few seconds.");
        }
      });
    }, 999); // 🕐 Delay 999 time units idk how long they are for Supabase to finish auto-login

    return () => clearTimeout(timeout);
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
