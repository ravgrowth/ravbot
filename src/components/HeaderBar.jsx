import LogoutButton from './LogoutButton.jsx';

export default function HeaderBar({ user }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h1 style={{ margin: 0 }}>RavBot Dashboard</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>{user.email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
