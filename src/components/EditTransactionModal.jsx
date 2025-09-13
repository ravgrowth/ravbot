import { useState } from 'react';

export default function EditTransactionModal({ transaction, override = {}, onClose, onSave }) {
  const [category, setCategory] = useState(override.category || '');
  const [notes, setNotes] = useState(override.notes || '');
  const categories = ['Food', 'Rent', 'Utilities', 'Entertainment', 'Travel', 'Shopping', 'Other'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', width: '300px' }}>
        <h3>Edit Transaction</h3>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
              <option value="">-- Select --</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%' }} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onSave(transaction.plaid_transaction_id, category, notes)}>Save</button>
        </div>
      </div>
    </div>
  );
}
