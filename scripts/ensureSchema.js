#!/usr/bin/env node
import dotenv from 'dotenv';
import logger from '../lib/logger.js';
import { CORE_TABLES, ensureTableExists, getPool } from '../lib/schema.js';

dotenv.config({ path: '.env.server' });

const EXTRA_TABLE_DEFS = {
  account_balances: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'account_id', type: 'uuid' },
    { name: 'date', type: 'date' },
    { name: 'balance', type: 'numeric' },
    { name: 'pnl', type: 'numeric' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  bank_connections: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'institution_name', type: 'text' },
    { name: 'institution_id', type: 'text' },
    { name: 'access_token', type: 'text' },
    { name: 'is_test', type: 'boolean', default: 'false' },
    { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
  ],
  subscriptions: [
    { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    { name: 'user_id', type: 'uuid' },
    { name: 'merchant_name', type: 'text' },
    { name: 'amount', type: 'numeric' },
    { name: 'interval', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
  ],
};

const PATCHED_TABLES = {
  idle_cash_recommendations_v2: [
    ...(CORE_TABLES.idle_cash_recommendations_v2 || []),
    { name: 'platform', type: 'text' },
    { name: 'target_account', type: 'text' },
  ],
};

async function ensureSchema() {
  const allTables = {
    ...CORE_TABLES,
    ...PATCHED_TABLES,
    ...EXTRA_TABLE_DEFS,
  };

  for (const [table, columns] of Object.entries(allTables)) {
    try {
      await ensureTableExists(table, columns);
      logger.info('[ensureSchema]', `ensured table ${table}`);
    } catch (err) {
      logger.error('[ensureSchema]', err, { table });
      throw err;
    }
  }
}

(async () => {
  try {
    await ensureSchema();
    logger.info('[ensureSchema]', 'schema ready');
  } catch (err) {
    console.error('[ensureSchema] failed', err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      const pool = getPool();
      await pool.end();
    } catch {}
  }
})();
