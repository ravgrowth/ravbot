import pg from 'pg'
import dotenv from 'dotenv'
import logger from './logger.js'

dotenv.config({ path: '.env.server' })

let pool = null
function getPool() {
  if (pool) return pool
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
  if (!url) throw new Error('No SUPABASE_DB_URL or DATABASE_URL in .env.server')
  pool = new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000 })
  return pool
}

function colSql(def) {
  const parts = []
  parts.push(`${def.name} ${def.type}`)
  if (def.primaryKey) parts.push('primary key')
  if (def.default) parts.push(`default ${def.default}`)
  if (def.notNull) parts.push('not null')
  return parts.join(' ')
}

export const CORE_TABLES = {
  user_budgets: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid', notNull: false },
    { name: 'rent', type: 'numeric' },
    { name: 'essentials', type: 'numeric' },
    { name: 'lifestyle', type: 'numeric' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  user_goals: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'goal_type', type: 'text' },
    { name: 'carrot', type: 'text' },
    { name: 'target', type: 'numeric' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  lifetime_savings: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'saved_amount', type: 'numeric', default: '0' },
    { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  idle_cash_recommendations: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'idle_amount', type: 'numeric' },
    { name: 'account_name', type: 'text' },
    { name: 'institution_name', type: 'text' },
    { name: 'bank_name', type: 'text' },
    { name: 'suggested_target', type: 'text' },
    { name: 'est_apy', type: 'numeric' },
    { name: 'recommendation', type: 'text' },
    { name: 'apy', type: 'numeric' },
    { name: 'account_id', type: 'text' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  idle_cash_recommendations_v2: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'balance', type: 'numeric' },
    { name: 'estimated_yearly_gain', type: 'numeric' },
    { name: 'account_name', type: 'text' },
    { name: 'institution_name', type: 'text' },
    { name: 'bank_name', type: 'text' },
    { name: 'suggested_target', type: 'text' },
    { name: 'est_apy', type: 'numeric' },
    { name: 'recommendation', type: 'text' },
    { name: 'apy', type: 'numeric' },
    { name: 'account_id', type: 'text' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  investment_positions: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'asset', type: 'text' },
    { name: 'balance', type: 'numeric' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  accounts: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'name', type: 'text' },
    { name: 'account_type', type: 'text' },
    { name: 'subtype', type: 'text' },
    { name: 'balance', type: 'numeric' },
    { name: 'currency', type: 'text' },
    { name: 'bank_connection_id', type: 'uuid' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  logs: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'action', type: 'text' },
    { name: 'payload', type: 'jsonb' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
}

export async function ensureTableExists(tableName, columns) {
  const scope = `[schema.ensure]`
  const pool = getPool()
  const client = await pool.connect()
  try {
    logger.debug(scope, `check table ${tableName}`)
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name=$1 limit 1`,
      [tableName]
    )
    if (exists.rowCount === 0) {
      const cols = columns.map(colSql).join(', ')
      const sql = `create table if not exists public."${tableName}" (${cols});`
      logger.info(scope, `creating table ${tableName}`, { sql })
      await client.query(sql)
    } else {
      // Ensure columns exist (add missing ones only)
      const current = await client.query(
        `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
        [tableName]
      )
      const have = new Set(current.rows.map(r => r.column_name))
      for (const c of columns) {
        if (!have.has(c.name)) {
          const alter = `alter table public."${tableName}" add column ${colSql(c)};`
          logger.info(scope, `adding column ${tableName}.${c.name}`, { alter })
          await client.query(alter)
        }
      }
    }
  } catch (err) {
    logger.error(scope, err, { tableName })
    throw err
  } finally {
    client.release()
  }
}

export async function ensureCoreTables() {
  for (const [name, cols] of Object.entries(CORE_TABLES)) {
    // Never drop — only add missing
    await ensureTableExists(name, cols)
  }
}

export async function ensureForQuery(tableName) {
  // Convenience to call right before a query
  const def = CORE_TABLES[tableName]
  if (def) await ensureTableExists(tableName, def)
}

