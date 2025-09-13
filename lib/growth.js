// Growth gap calculations and equivalents

export function annualGain(principal, rate) {
  return Number(principal) * Number(rate);
}

export function growthGap(idleAmount, betterRate, currentRate = 0) {
  const delta = Number(betterRate) - Number(currentRate);
  return Number(idleAmount) * Math.max(delta, 0);
}

export function lifestyleEquivalents(yearly) {
  const items = [
    { label: 'months of Spotify', cost: 11.0 },
    { label: 'coffee per day (1 year)', cost: 4.0 * 365 },
    { label: 'roundtrip domestic flight', cost: 350 },
    { label: 'week of groceries', cost: 120 },
  ];
  const results = [];
  for (const it of items) {
    const qty = yearly / it.cost;
    if (qty >= 1) results.push(`${Math.floor(qty)} ${it.label}`);
  }
  return results;
}

