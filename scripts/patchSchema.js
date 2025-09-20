/* eslint-env node */
// Robust, idempotent schema patcher for local/dev. Safe to run repeatedly.
// - Prefers SUPABASE_DB_URL (direct) for patching; falls back to DATABASE_URL.
// - SSL enabled with rejectUnauthorized: false for Supabase hosts.
// - Logs [PATCH] steps. Never throws fatally; always exits 0 so dev keeps running.

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.server' })

const connString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const source = process.env.SUPABASE_DB_URL ? 'SUPABASE_DB_URL' : (process.env.DATABASE_URL ? 'DATABASE_URL' : 'NONE')

function makePool(url) {
  if (!url) throw new Error('No SUPABASE_DB_URL or DATABASE_URL set')
  const needsSsl = /supabase\.com/i.test(url)
  const config = { connectionString: url, max: 1, idleTimeoutMillis: 10_000 }
  if (needsSsl) config.ssl = { rejectUnauthorized: false }
  return new pg.Pool(config)
}

async function ensureTable(pool, table, columns) {
  const tag = `[PATCH] table ${table}`
  try {
    const c = await pool.connect()
    try {
      const exists = await c.query(
        `select 1 from information_schema.tables where table_schema='public' and table_name=$1 limit 1`,
        [table]
      )
      if (exists.rowCount === 0) {
        const parts = columns.map(col => {
          const bits = [ `${col.name} ${col.type}` ]
          if (col.primaryKey) bits.push('primary key')
          if (col.default) bits.push(`default ${col.default}`)
          if (col.notNull) bits.push('not null')
          return bits.join(' ')
        })
        const sql = `create table if not exists public."${table}" (${parts.join(', ')});`
        console.log(`${tag}: creating`)
        await c.query(sql)
      } else {
        console.log(`${tag}: already exists`)
      }
    } finally { c.release() }
  } catch (e) {
    console.log(`${tag}: error`, e?.message || e)
  }
}

async function ensureColumn(pool, table, column) {
  const tag = `[PATCH] column ${table}.${column.name}`
  try {
    const c = await pool.connect()
    try {
      const cur = await c.query(
        `select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`,
        [table, column.name]
      )
      if (cur.rowCount === 0) {
        const bits = [ `${column.name} ${column.type}` ]
        if (column.default) bits.push(`default ${column.default}`)
        if (column.notNull) bits.push('not null')
        const alter = `alter table public."${table}" add column ${bits.join(' ')};`
        console.log(`${tag}: adding`)
        await c.query(alter)
      } else {
        console.log(`${tag}: already exists`)
      }
    } finally { c.release() }
  } catch (e) {
    console.log(`${tag}: error`, e?.message || e)
  }
}

async function main() {
  console.log(`[PATCH] connect via ${source}`)
  let pool
  try {
    pool = makePool(connString)
  } catch (e) {
    console.log('[PATCH] connect error', e?.message || e)
    process.exit(0)
    return
  }

  // Required schema (minimal columns required by app queries)
  const tables = {
    accounts: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'balance', type: 'numeric' },
      { name: 'account_type', type: 'text' },
      { name: 'subtype', type: 'text' },
      { name: 'currency', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
    ],
    user_goals: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid' },
      { name: 'goal_type', type: 'text' },
      { name: 'carrot', type: 'text' },
      { name: 'target', type: 'numeric' },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
    ],
    lifetime_savings: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid' },
      { name: 'saved_amount', type: 'numeric', default: '0' },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
    ],
    user_budgets: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid' },
      { name: 'rent', type: 'numeric' },
      { name: 'essentials', type: 'numeric' },
      { name: 'lifestyle', type: 'numeric' },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
    ],
    idle_cash_recommendations: [
      { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid' },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
      { name: 'idle_amount', type: 'numeric' },
    ],
  }

  // Create tables first
  for (const [name, cols] of Object.entries(tables)) {
    await ensureTable(pool, name, cols)
  }
  // Then ensure required columns (in case table exists but lacks columns)
  for (const [name, cols] of Object.entries(tables)) {
    for (const col of cols) {
      await ensureColumn(pool, name, col)
    }
  }

  try { await pool.end() } catch {}
  process.exit(0)
}

main().catch(() => process.exit(0))

