/** Local dev only — production pages on inaayat.xyz use the main site's /api/auth-config. */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET.' });
    return;
  }
  const url = process.env.NEON_AUTH_BASE_URL;
  if (!url) {
    res.status(503).json({ error: 'NEON_AUTH_BASE_URL not configured.' });
    return;
  }
  res.status(200).json({ url });
}
