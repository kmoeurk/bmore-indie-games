// Vercel Serverless Function — IGDB API Proxy
// Keeps IGDB credentials server-side, away from the browser.

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const params = new URLSearchParams({
    client_id: (process.env.IGDB_CLIENT_ID || '').trim(),
    client_secret: (process.env.IGDB_CLIENT_SECRET || '').trim(),
    grant_type: 'client_credentials',
  });
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // refresh 1 min early
  return cachedToken;
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let parsed;
  try {
    if (!req.body && req.body !== 0) {
      parsed = await parseBody(req);
    } else if (typeof req.body === 'object') {
      parsed = req.body;
    } else {
      parsed = JSON.parse(req.body);
    }
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { endpoint, body } = parsed;

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
        'Client-ID': (process.env.IGDB_CLIENT_ID || '').trim(),
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
