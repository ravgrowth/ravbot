import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Dashboard from './pages/dashboard.jsx';
import Login from './pages/login.jsx';

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const path = window.location.pathname;

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session check failed:", error.message);
        setChecking(false);
        return;
      }

      setSession(data.session);
      setChecking(false);

      // Redirect if user is logged in and on / or /login
      if (data.session && (path === "/" || path === "/login")) {
        window.location.href = "/dashboard";
      }
    };

    console.log("Checking session for path:", path);
    console.log("Session data:", data.session);
    checkSession();
    
  }, [path]);

  if (checking) return <p>Loading...</p>;

  if (path === "/dashboard") return <Dashboard />;
  return <Login />;
}

export default App;
