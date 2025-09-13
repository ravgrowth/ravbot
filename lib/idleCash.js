// Helpers for idle cash calculations

export function sumIdleAmount(rows = []) {
  return rows.reduce((acc, r) => acc + Number(r.idle_amount ?? r.balance ?? 0), 0);
}

export function groupByInstitution(rows = []) {
  const map = {};
  for (const r of rows) {
    const key = r.institution_name || r.bank_name || r.account_provider || 'Unknown';
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }
  return map;
}

export function suggestedMoves(rows = []) {
  // Normalize suggestions from v1/v2 tables
  // Expect fields like: suggested_target, target_type, est_apy, notes
  return rows
    .map((r) => {
      const amount = Number(r.idle_amount ?? r.balance ?? 0);
      const target = r.suggested_target || r.recommendation || 'High-Yield Savings (e.g., Ally)';
      const apy = r.est_apy ?? r.apy ?? null;
      return { amount, target, apy };
    })
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

