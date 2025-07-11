import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const path = window.location.pathname;

  if (path === '/dashboard') {
    return <Dashboard />;
  }

  return <Login />;
}

export default App;
