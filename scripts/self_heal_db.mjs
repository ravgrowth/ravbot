import dotenv from 'dotenv'
import { ensureCoreTables } from '../lib/schema.js'

async function main() {
  dotenv.config({ path: '.env.server' })
  try {
    console.log('[DEBUG] self-heal: ensuring core tables via pg connection')
    await ensureCoreTables()
    console.log('[DEBUG] self-heal: done')
    process.exit(0)
  } catch (e) {
    console.error('[DEBUG] self-heal: failed', e?.stack || e)
    process.exit(1)
  }
}

main()

