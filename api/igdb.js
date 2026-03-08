// Vercel Serverless Function — IGDB API Proxy
// Keeps IGDB credentials server-side, away from the browser.

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.IGDB_CLIENT_ID,
      client_secret: process.env.IGDB_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // refresh 1 min early
  return cachedToken;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, body } = req.body;

  if (!endpoint || !body) {
    return res.status(400).json({ error: 'Missing endpoint or body' });
  }

  // Allowlist endpoints to prevent abuse
  const allowed = ['games', 'covers', 'screenshots', 'genres', 'platforms', 'search'];
  if (!allowed.includes(endpoint)) {
    return res.status(403).json({ error: 'Endpoint not allowed' });
  }

  try {
    const token = await getAccessToken();

    const igdbRes = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-ID': process.env.IGDB_CLIENT_ID,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!igdbRes.ok) {
      const errText = await igdbRes.text();
      return res.status(igdbRes.status).json({ error: errText });
    }

    const data = await igdbRes.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    console.error('IGDB proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
