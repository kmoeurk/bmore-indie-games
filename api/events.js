// Vercel Serverless Function — Eventbrite Events Proxy
// Keeps API key server-side. Returns [] gracefully if key not set.

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let parsed;
  try {
    parsed = req.body && typeof req.body === 'object' ? req.body : await parseBody(req);
  } catch { return res.status(400).json({ error: 'Invalid body' }); }

  const { lat, lng } = parsed;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const token = (process.env.EVENTBRITE_API_KEY || '').trim();
  if (!token) {
    // No key configured — return empty so the page falls back to local.json events
    return res.status(200).json([]);
  }

  const keywords = ['indie game', 'game jam', 'gaming', 'board game'];
  const seen = new Set();
  const results = [];

  for (const q of keywords) {
    try {
      const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
      url.searchParams.set('q', q);
      url.searchParams.set('location.latitude', lat);
      url.searchParams.set('location.longitude', lng);
      url.searchParams.set('location.within', '25mi');
      url.searchParams.set('sort_by', 'date');
      url.searchParams.set('expand', 'venue');
      url.searchParams.set('start_date.range_start', new Date().toISOString().split('.')[0] + 'Z');

      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) continue;

      const data = await r.json();
      for (const event of (data.events || [])) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          results.push(event);
        }
      }
    } catch { /* skip failed keyword */ }
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(results);
}
