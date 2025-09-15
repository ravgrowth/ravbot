export function log(scope, msg, payload) {
  const d = new Date()
  const iso = d.toISOString()
  const human = d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  if (payload !== undefined) console.log(`[${iso} | ${human}] ${scope} ${msg}`, payload)
  else console.log(`[${iso} | ${human}] ${scope} ${msg}`)
}
export function logError(scope, err, context) {
  const d = new Date()
  const iso = d.toISOString()
  const human = d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const code = err?.code || err?.status || err?.name || 'ERR'
  const hint = err?.hint || err?.response?.data?.hint
  const message = err?.message || err?.response?.data?.message || String(err)
  console.error(`[${iso} | ${human}] ${scope} ERROR`, { code, hint, message, context })
}
