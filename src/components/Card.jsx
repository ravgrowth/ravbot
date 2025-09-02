export default function Card({ title, actions, children }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
