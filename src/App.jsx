import Login from './pages/login.jsx';
import Dashboard from './pages/dashboard.jsx'

function App() {
  const path = window.location.pathname;

  if (path === '/dashboard') {
    return <Dashboard />;
  }

  return <Login />;
}

export default App;
