import { getAuth } from '../lib/neon-auth.js';
import { db, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  const route = String(req.query?.route || '').trim();
  switch (route) {
    case 'me':
      return handleMe(req, res);
    default:
      res.status(404).json({ error: 'Unknown OMC route.' });
  }
}

async function handleMe(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET.' });
    return;
  }
  if (!process.env.NEON_AUTH_BASE_URL) {
    res.status(503).json({ error: 'NEON_AUTH_BASE_URL not configured.' });
    return;
  }
  if (!process.env.DATABASE_URL) {
    res.status(503).json({ error: 'DATABASE_URL not configured.' });
    return;
  }

  const auth = await getAuth(req);
  if (!auth) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }

  try {
    await ensureSchema();
    const rows = await db()`
      INSERT INTO users (id, email, name)
      VALUES (${auth.sub}, ${auth.email || null}, ${auth.name || null})
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, name = EXCLUDED.name, last_seen_at = now()
      RETURNING id, email, name, created_at, last_seen_at
    `;
    res.status(200).json({ user: rows[0], auth: { sub: auth.sub } });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
