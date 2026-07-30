// Neon Postgres access for api/*.js routes. Lazy init so the module can be
// imported before DATABASE_URL is configured — routes return 503 instead of
// crashing at import time.
import { neon } from '@neondatabase/serverless';

let _sql = null;

export function db() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

let _schemaReady = null;

/** Ensures shared users table exists (same schema as inaayat.xyz apps). */
export function ensureSchema() {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT,
          name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      _schemaReady = null;
      throw err;
    });
  }
  return _schemaReady;
}
