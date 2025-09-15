import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import Card from './Card.jsx'
import { log, logError } from '../utils/log.js'

export default function RecentLogs() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/logs/recent', { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed logs')
        setRows(json.logs || [])
        log('[RecentLogs]', 'loaded', { count: (json.logs||[]).length })
      } catch (e) {
        logError('[RecentLogs]', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Card title="Recent Logs">
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>No logs yet</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r, i) => (
            <li key={i} style={{ borderBottom: '1px solid #eee', padding: '6px 0' }}>
              <div style={{ fontWeight: 600 }}>{r.action}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{new Date(r.created_at).toLocaleString()}</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{JSON.stringify(r.payload, null, 2)}</pre>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

