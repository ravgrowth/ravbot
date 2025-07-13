import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/login.jsx";
import Reset from "./pages/reset.jsx";
import Dashboard from "./pages/dashboard.jsx";
import ChangeEmail from './pages/ChangeEmail.jsx';

function AppWrapper() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      const hash = window.location.hash;
      const isRecovery = hash.includes("type=recovery");

      if (isRecovery) {
        setRecoveryMode(true);
        // wait for Supabase to auto-login user
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: sessionData } = await supabase.auth.getSession();
          setSession(sessionData.session);
        }
        setChecking(false);
        return;
      }

      // regular auth check
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);
      setChecking(false);
    };

    checkSession();
  }, []);

  if (checking) return <p>Loading...</p>;
  if (recoveryMode) return <Reset />;

  return (
    <Routes>
      <Route path="/" element={session ? <Dashboard /> : <Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route path="/dashboard" element={session ? <Dashboard /> : <Login />} />
      <Route path="/reset/*" element={<Reset />} />
      <Route path="/change-email" element={<ChangeEmail />} />
    </Routes>
  );
}

export default function App() {
  return <AppWrapper />;
}
