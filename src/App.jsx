import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import Login from "./pages/login.jsx";
import Reset from "./pages/reset.jsx";
import Dashboard from "./pages/dashboard.jsx";
import ChangeEmail from './pages/ChangeEmail.jsx';
import Settings from './pages/settings.jsx';
import Goals from './pages/goals.jsx';

function MessageBanner() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("message=")) {
      const params = new URLSearchParams(hash.slice(1)); // remove the '#'
      const msg = params.get("message");
      if (msg) {
        setMessage(decodeURIComponent(msg));
        // Optionally remove the message from the URL after showing
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  if (!message) return null;

  return (
    <div style={{ 
      background: "#e0f7ff", 
      padding: "12px", 
      textAlign: "center", 
      fontWeight: "bold",
      borderBottom: "2px solid #00bcd4"
    }}>
      {message}
    </div>
  );
}

function AppWrapper() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

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
    <>
      <MessageBanner />
      <Routes>
        <Route path="/" element={session ? <Dashboard /> : <Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Login />} />
        <Route path="/reset/*" element={<Reset />} />
        <Route path="/change-email" element={<ChangeEmail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/goals" element={session ? <Goals /> : <Login />} />
      </Routes>
    </>
  );
}

export default function App() {
  return <AppWrapper />;
}
