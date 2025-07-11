import { useEffect, useState } from "react";
import Dashboard from './pages/dashboard.jsx';
import Login from './pages/login.jsx';

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const path = window.location.pathname;

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setChecking(false);

      // If user is signed in and trying to access / or /login → redirect to /dashboard
      if (session && (path === "/" || path === "/login")) {
        window.location.href = "/dashboard";
      }
    };
    check();
  }, []);

  if (checking) return <p>Checking session...</p>;

  if (path === "/dashboard") return <Dashboard />;
  return <Login />;
}

export default App;
