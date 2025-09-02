import { supabase } from '../supabaseClient.js';

export default function DownloadCsvButton({ userId }) {
  const handleDownload = async () => {
    const { data: txns } = await supabase
      .from('transactions')
      .select('transaction_id, date, merchant_name, name, amount')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(200);

    const { data: ovs } = await supabase
      .from('transaction_overrides')
      .select('transaction_id, category, notes')
      .eq('user_id', userId);

    const overrides = {};
    (ovs || []).forEach((o) => {
      overrides[o.transaction_id] = o;
    });

    const header = ['date', 'merchant', 'raw_name', 'amount', 'category', 'notes'];
    const rows = (txns || []).map((t) => {
      const o = overrides[t.transaction_id] || {};
      return {
        date: t.date,
        merchant: t.merchant_name || '',
        raw_name: t.name || '',
        amount: t.amount,
        category: o.category || '',
        notes: o.notes || '',
      };
    });

    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.date,
          `"${(r.merchant || '').replace(/"/g, '""')}`,
          `"${(r.raw_name || '').replace(/"/g, '""')}`,
          r.amount,
          r.category,
          `"${(r.notes || '').replace(/"/g, '""')}`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return <button onClick={handleDownload}>Download CSV</button>;
}
