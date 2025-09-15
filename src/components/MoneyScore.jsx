import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { computeMoneyScore } from '../../lib/moneyScore.js'
import { log, logError } from '../utils/log.js'

export default function MoneyScore({ userId }) {
  const [assets, setAssets] = useState(0)
  const [debts, setDebts] = useState(0)
  const [redact, setRedact] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        log('[MoneyScore]', 'load start', { userId })
        const { data: accts } = await supabase
          .from('accounts')
          .select('id, account_type, subtype, balance')
          .eq('user_id', userId)
        let a = 0
        let d = 0
        for (const r of accts || []) {
          const t = String(r.account_type || '').toLowerCase()
          const s = String(r.subtype || '').toLowerCase()
          const val = Number(r.balance || 0)
          const isDebt = t.includes('loan') || t.includes('credit') || s.includes('loan') || s.includes('debt') || val < 0
          if (isDebt) d += Math.abs(val)
          else a += Math.max(0, val)
        }
        setAssets(a)
        setDebts(d)
        log('[MoneyScore]', 'load done', { assets: a, debts: d })
      } catch (e) {
        logError('[MoneyScore]', e, { userId })
      } finally {
        setLoading(false)
      }
    }
    if (userId) load()
  }, [userId])

  const { netWorth, score, grade } = useMemo(() => computeMoneyScore({ assets, debts }), [assets, debts])
  const redacted = redact ? '•••••' : netWorth.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Money Score:</div>
      {loading ? (
        <span>Loading…</span>
      ) : (
        <>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{grade}</span>
          <span style={{ color: '#666' }}>({score})</span>
          <span style={{ marginLeft: 12 }}>Net Worth:</span>
          <span style={{ fontWeight: 700 }}>{redacted}</span>
          <button style={{ marginLeft: 8 }} onClick={() => setRedact(!redact)}>{redact ? 'Unhide' : 'Hide'}</button>
        </>
      )}
    </div>
  )
}

