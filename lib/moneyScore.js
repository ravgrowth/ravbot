// Prototype Money Score utility
// Normalizes net worth to 0-100 and maps to letter grade (X/S/A-F)

export function normalizeNetWorth(netWorth) {
  // Simple sigmoid-ish normalization around $0..$1M
  const nw = Number(netWorth || 0)
  const clamped = Math.max(-500_000, Math.min(2_000_000, nw))
  const pct = (clamped + 500_000) / 2_500_000 // -500k => 0, 2M => 1
  return Math.round(pct * 100)
}

export function gradeFromScore(score) {
  if (score >= 100) return 'X'
  if (score >= 98) return 'S'
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export function computeMoneyScore({ assets = 0, debts = 0 }) {
  const netWorth = Number(assets || 0) - Number(debts || 0)
  const score = normalizeNetWorth(netWorth)
  const grade = gradeFromScore(score)
  return { netWorth, score, grade }
}

