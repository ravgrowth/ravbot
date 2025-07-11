import { useEffect, useState } from 'react';
import { supabase } from "../supabaseClient";

export default function Reset() {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('Waiting for token...');
  const [email, setEmail] = useState('');

  useEffect(() => {
    setTimeout(() => {
      console.log("Full URL:", window.location.href);
      console.log("Hash:", window.location.hash);

      const hash = window.location.hash;
      const isRecovery = hash.includes("access_token") && hash.includes("type=recovery");

      if (!isRecovery) {
        setStatus("Invalid recovery link");
        return;
      }

      // Ask Supabase for the user
      supabase.auth.getUser().then(({ data, error }) => {
        console.log("USER:", data?.user);
        console.log("ERROR:", error);

        if (data?.user?.email) {
          setEmail(data.user.email);
          setStatus("Enter your new password");
        } else {
          setStatus("Could not load user.");
        }
      });
    }, 500); // half second delay
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
