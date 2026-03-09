// BMore Indie Games — Local Scene JS
// Developers + Events: Supabase (fallback: local.json)
// Stores: OpenStreetMap Overpass API (live, no key needed)
// City name: Nominatim reverse geocoding
// Eventbrite events: /api/events serverless proxy

const NOMINATIM  = 'https://nominatim.openstreetmap.org';
const OVERPASS   = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'BMoreIndieGames/1.0 (https://bmore-indie-games.vercel.app)';
const RADIUS_MI  = 25;
const RADIUS_M   = RADIUS_MI * 1609.34;

let localDevs  = [];   // from Supabase (or fallback JSON)
let localEvents = [];  // from Supabase (or fallback JSON)
let userLat    = null;
let userLng    = null;
let cityName   = '';
let osmStores  = [];   // live from Overpass
let liveEvents = [];   // live from Eventbrite

// ── Hamburger ──────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

// ── Init ───────────────────────────────────────────────────
async function init() {
  await Promise.all([loadDevelopers(), loadCommunityEvents()]);
  renderDevs();
  renderStores();
  renderEvents();
  updateCounts();
}

// ── Load developers from Supabase (fallback: local.json) ───
async function loadDevelopers() {
  try {
    const { data, error } = await db.from('developers').select('*').order('name');
    if (error || !data || data.length === 0) throw new Error(error?.message || 'empty');
    localDevs = data.map(mapDBDeveloper);
  } catch (e) {
    console.warn('Supabase developers unavailable, falling back to local.json:', e.message);
    try {
      const res = await fetch('data/local.json');
      const j   = await res.json();
      localDevs = j.developers || [];
    } catch { localDevs = []; }
  }
}

// ── Load community events from Supabase (fallback: local.json)
async function loadCommunityEvents() {
  try {
    const { data, error } = await db
      .from('events')
      .select('*')
      .eq('source', 'community')
      .order('event_date');
    if (error || !data || data.length === 0) throw new Error(error?.message || 'empty');
    localEvents = data.map(mapDBEvent);
  } catch (e) {
    console.warn('Supabase events unavailable, falling back to local.json:', e.message);
    try {
      const res = await fetch('data/local.json');
      const j   = await res.json();
      localEvents = j.events || [];
    } catch { localEvents = []; }
  }
}

// ── Tab Switching ───────────────────────────────────────────
function switchTab(btn, tab) {
  document.querySelectorAll('.local-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.local-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
}

// ── Geolocation ─────────────────────────────────────────────
function detectLocation() {
  if (!navigator.geolocation) {
    setLocationError('Geolocation not supported by your browser.');
    return;
  }
  const btn = document.getElementById('detect-location-btn');
  btn.textContent = '⏳ Detecting…';
  btn.disabled    = true;

  navigator.geolocation.getCurrentPosition(
    async pos => {
      userLat  = pos.coords.latitude;
      userLng  = pos.coords.longitude;
      setLocationStatus('🔍 Getting your city name…');
      cityName = await reverseGeocode(userLat, userLng);
      updatePageHeader();
      setLocationSuccess(`Showing indie scene near ${cityName}`);
      await Promise.all([loadOSMStores(), loadEventbriteEvents()]);
      renderAll();
      updateCounts();
    },
    err => {
      btn.textContent = '📍 Use My Location';
      btn.disabled    = false;
      if (err.code === 1) setLocationError('Location denied. Enter a ZIP code below.');
      else                setLocationError('Could not detect location. Try a ZIP code.');
    },
    { timeout: 10000 }
  );
}

async function useZipCode() {
  const zip = document.getElementById('zip-input').value.trim();
  if (!/^\d{5}$/.test(zip)) {
    document.getElementById('zip-input').style.borderColor = 'var(--danger)';
    return;
  }
  document.getElementById('zip-input').style.borderColor = '';
  setLocationStatus('🔍 Looking up ZIP code…');

  try {
    const res  = await fetch(
      `${NOMINATIM}/search?postalcode=${zip}&country=US&format=json&limit=1`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    const data = await res.json();
    if (!data.length) throw new Error('ZIP not found');
    userLat  = parseFloat(data[0].lat);
    userLng  = parseFloat(data[0].lon);
    cityName = await reverseGeocode(userLat, userLng);
    updatePageHeader();
    setLocationSuccess(`Showing indie scene near ${cityName}`);
    await Promise.all([loadOSMStores(), loadEventbriteEvents()]);
    renderAll();
    updateCounts();
  } catch {
    setLocationError('Could not find that ZIP code. Try another.');
  }
}

// ── Nominatim Reverse Geocoding ──────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(
      `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    const data = await res.json();
    const a    = data.address || {};
    return a.city || a.town || a.village || a.county || a.state || 'Your Area';
  } catch {
    return 'Your Area';
  }
}

// ── OpenStreetMap Overpass — Nearby Game Stores ──────────────
async function loadOSMStores() {
  setStoresStatus('🔍 Searching OpenStreetMap for nearby stores…');
  try {
    const q = `
      [out:json][timeout:25];
      (
        node["shop"="games"](around:${RADIUS_M},${userLat},${userLng});
        node["shop"="hobby"](around:${RADIUS_M},${userLat},${userLng});
        node["shop"="board_games"](around:${RADIUS_M},${userLat},${userLng});
        node["leisure"="amusement_arcade"](around:${RADIUS_M},${userLat},${userLng});
        node["amenity"="gaming"](around:${RADIUS_M},${userLat},${userLng});
        way["shop"="games"](around:${RADIUS_M},${userLat},${userLng});
        way["shop"="hobby"](around:${RADIUS_M},${userLat},${userLng});
        way["leisure"="amusement_arcade"](around:${RADIUS_M},${userLat},${userLng});
      );
      out center;
    `;
    const res  = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q),
    });
    const data = await res.json();
    const TYPE_LABEL = {
      games: 'Game Store', hobby: 'Hobby Shop', board_games: 'Board Game Cafe',
      amusement_arcade: 'Arcade', gaming: 'Gaming Center',
    };
    osmStores = (data.elements || [])
      .filter(el => el.tags?.name)
      .map(el => {
        const lat  = el.lat ?? el.center?.lat;
        const lng  = el.lon ?? el.center?.lon;
        const t    = el.tags;
        const tag  = t.shop || t.leisure || t.amenity || 'games';
        const addr = [t['addr:housenumber'], t['addr:street'], t['addr:city'], t['addr:state']].filter(Boolean);
        return {
          id:           `osm_${el.id}`,
          name:         t.name,
          type:         TYPE_LABEL[tag] || 'Game Store',
          address:      addr.length ? addr.join(' ') : 'See Google Maps',
          hours:        t.opening_hours || '',
          website:      t.website || t['contact:website'] || '',
          phone:        t.phone || t['contact:phone'] || '',
          description:  t.description || '',
          specialties:  [],
          indieSection: false,
          lat, lng,
          fromOSM: true,
        };
      })
      .filter(s => s.lat && s.lng);
  } catch (e) {
    console.warn('Overpass error:', e);
    osmStores = [];
  }
}

// ── Eventbrite Events ────────────────────────────────────────
async function loadEventbriteEvents() {
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: userLat, lng: userLng }),
    });
    if (!res.ok) { liveEvents = []; return; }
    const raw = await res.json();
    liveEvents = raw
      .map(e => {
        const venue = e.venue || {};
        const addr  = venue.address || {};
        const lat   = parseFloat(addr.latitude)  || null;
        const lng   = parseFloat(addr.longitude) || null;
        return {
          id:           `eb_${e.id}`,
          name:         e.name?.text || 'Untitled Event',
          type:         classifyEventType(e.name?.text || '', e.description?.text || ''),
          description:  (e.description?.text || '').slice(0, 200),
          location:     venue.name || addr.localized_address_display || 'See Eventbrite',
          date:         (e.start?.local || '').split('T')[0],
          time:         (e.start?.local || '').split('T')[1]?.slice(0, 5) || '',
          cost:         e.is_free ? 'Free' : (e.ticket_availability?.minimum_ticket_price?.display || 'Paid'),
          website:      e.url || '#',
          attending:    e.capacity || 0,
          tags:         [],
          lat, lng,
          fromEventbrite: true,
        };
      })
      .filter(e => e.date);
  } catch {
    liveEvents = [];
  }
}

function classifyEventType(name, desc) {
  const t = (name + ' ' + desc).toLowerCase();
  if (t.includes('jam'))                                          return 'Game Jam';
  if (t.includes('workshop'))                                     return 'Workshop';
  if (t.includes('conference') || t.includes('summit') || t.includes('expo')) return 'Conference';
  if (t.includes('showcase') || t.includes('demo'))              return 'Showcase';
  if (t.includes('meetup') || t.includes('meet up'))             return 'Meetup';
  return 'Social';
}

// ── Haversine Distance ───────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceMiles(item) {
  if (!userLat || item.lat == null) return Infinity;
  return haversineKm(userLat, userLng, item.lat, item.lng) * 0.621371;
}

function fmtDist(item) {
  const mi = distanceMiles(item);
  if (!isFinite(mi)) return '';
  if (mi < 0.5)      return '< 0.5 mi';
  return `${mi.toFixed(1)} mi`;
}

// ── Card HTML Helpers ────────────────────────────────────────
function devCardHTML(d) {
  const dist     = fmtDist(d);
  const cityLine = d.city ? `${d.city}, ${d.state}` : d.location;
  return `
  <div class="card-dev">
    <div class="dev-header">
      <div class="dev-avatar">${d.name.charAt(0)}</div>
      <div class="dev-info">
        <div class="dev-name">${d.name}</div>
        <div class="dev-type">${d.type}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
        ${d.hiring ? '<span class="dev-badge">Hiring</span>' : ''}
        ${dist ? `<span style="font-size:0.78rem;color:var(--purple-400);font-weight:600;white-space:nowrap;">📍 ${dist}</span>` : ''}
      </div>
    </div>
    <div class="dev-description">${d.description}</div>
    <div class="dev-games"><strong>Games:</strong> ${(d.games || []).join(', ')}</div>
    <div class="card-tags" style="margin-bottom:14px;">
      ${(d.genres || []).map(g => `<span class="tag tag-purple">${g}</span>`).join('')}
    </div>
    <div class="dev-footer">
      <div class="dev-location">📍 ${cityLine}</div>
      ${d.website ? `<a href="${d.website}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:5px 12px;font-size:0.8rem;">Website →</a>` : ''}
    </div>
  </div>`;
}

function storeCardHTML(s) {
  const dist    = fmtDist(s);
  const ICON    = { 'Game Store':'🎮','Hobby Shop':'🃏','Board Game Cafe':'♟️','Arcade':'🕹','Gaming Center':'🖥','Retail + Arcade':'🕹','Used Games':'📀','Gaming Lounge':'🎮','Esports Center':'🏆' };
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address || s.name)}`;
  return `
  <div class="card-store">
    <div class="store-header">
      <div class="store-icon">${ICON[s.type] || '🏪'}</div>
      <div>
        <div class="store-name">${s.name}</div>
        <div class="store-type">${s.type}</div>
      </div>
      ${dist ? `<div style="margin-left:auto;font-size:0.85rem;color:var(--purple-400);font-weight:600;">${dist}</div>` : ''}
    </div>
    <div class="store-body">
      ${s.description ? `<p style="font-size:0.85rem;color:var(--gray-400);margin-bottom:12px;line-height:1.6;">${s.description}</p>` : ''}
      <div class="store-address">📍 <span>${s.address}</span></div>
      ${s.hours ? `<div class="store-hours">🕐 <span>${s.hours}</span></div>` : ''}
      <div class="card-tags" style="margin-top:10px;">
        ${(s.specialties || []).map(sp => `<span class="tag">${sp}</span>`).join('')}
        ${s.indieSection ? '<span class="tag tag-purple">Indie Section ✓</span>' : ''}
        ${s.fromOSM ? '<span class="tag" style="opacity:0.5;">OpenStreetMap</span>' : ''}
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:6px 14px;font-size:0.82rem;">🗺 Get Directions</a>
        ${s.website ? `<a href="${s.website}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:6px 14px;font-size:0.82rem;">Website →</a>` : ''}
      </div>
    </div>
  </div>`;
}

function eventCardHTML(e) {
  const date  = new Date(e.date + 'T00:00:00');
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
  const day   = date.getDate();
  const isFree = e.cost === 'Free' || e.cost === '$0';
  const dist  = fmtDist(e);
  return `
  <div class="card-event">
    <div class="event-date-block">
      <div class="event-month">${month}</div>
      <div class="event-day">${day}</div>
    </div>
    <div class="event-info">
      <div class="event-name">${e.name}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
        <span class="event-type-badge">${e.type}</span>
        ${e.fromEventbrite ? '<span class="event-type-badge" style="background:rgba(244,123,32,0.15);color:#f47b20;border-color:rgba(244,123,32,0.3);">Eventbrite</span>' : ''}
      </div>
      ${e.description ? `<div class="event-description">${e.description}</div>` : ''}
      <div class="event-meta">
        ${e.time     ? `<span>🕐 ${e.time}</span>`        : ''}
        ${e.location ? `<span>📍 ${e.location}</span>`    : ''}
        ${dist       ? `<span>📏 ${dist}</span>`           : ''}
        ${e.attending ? `<span>👥 ${e.attending}</span>`  : ''}
      </div>
      <div class="card-tags" style="margin-top:10px;">
        ${(e.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
    </div>
    <div class="event-aside">
      <div class="event-cost ${isFree ? 'free' : ''}">${e.cost}</div>
      <a href="${e.website}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:7px 16px;font-size:0.82rem;">
        ${e.fromEventbrite ? 'Register →' : 'Details →'}
      </a>
    </div>
  </div>`;
}

// ── Render Developers ────────────────────────────────────────
function renderDevs() {
  const container   = document.getElementById('devs-grid');
  const empty       = document.getElementById('devs-empty');
  const genreFilter = document.getElementById('dev-genre').value;
  const hiringOnly  = document.getElementById('hiring-filter').checked;
  const sort        = document.getElementById('dev-sort').value;

  let devs = [...localDevs];
  if (genreFilter) devs = devs.filter(d => (d.genres || []).includes(genreFilter));
  if (hiringOnly)  devs = devs.filter(d => d.hiring);

  if (sort === 'distance' && userLat) devs.sort((a, b) => distanceMiles(a) - distanceMiles(b));
  else if (sort === 'name')           devs.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'founded')        devs.sort((a, b) => (a.founded || 0) - (b.founded || 0));
  else                                devs.sort((a, b) => a.name.localeCompare(b.name));

  empty.classList.toggle('hidden', devs.length > 0);
  container.innerHTML = devs.length === 0 ? '' : devs.map(devCardHTML).join('');

  if (!userLat) {
    const notice = document.createElement('div');
    notice.style.cssText = 'grid-column:1/-1;background:rgba(109,40,217,0.08);border:1px solid rgba(109,40,217,0.2);border-radius:12px;padding:16px 20px;font-size:0.875rem;color:var(--gray-400);margin-bottom:8px;';
    notice.innerHTML = '📍 <strong style="color:var(--gray-200);">Share your location</strong> to see which developers are closest to you.';
    container.prepend(notice);
  }
}

// ── Render Stores ────────────────────────────────────────────
function renderStores() {
  const container = document.getElementById('stores-grid');
  const indieOnly = document.getElementById('indie-filter').checked;
  const sort      = document.getElementById('store-sort').value;

  if (!userLat) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:56px 24px;color:var(--gray-400);">
        <div style="font-size:2.5rem;margin-bottom:16px;">🏪</div>
        <h3 style="margin-bottom:8px;color:var(--gray-300);">Find game stores near you</h3>
        <p style="font-size:0.9rem;max-width:400px;margin:0 auto 20px;">We'll search OpenStreetMap for game stores, arcades, and hobby shops within ${RADIUS_MI} miles.</p>
        <button class="btn btn-primary" onclick="detectLocation()">📍 Use My Location</button>
      </div>`;
    return;
  }

  let stores = indieOnly ? osmStores.filter(s => s.indieSection) : [...osmStores];
  if (sort === 'distance') stores.sort((a, b) => distanceMiles(a) - distanceMiles(b));
  if (sort === 'name')     stores.sort((a, b) => a.name.localeCompare(b.name));

  if (stores.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--gray-400);">
        <div style="font-size:2.5rem;margin-bottom:16px;">🔍</div>
        <h3 style="margin-bottom:8px;color:var(--gray-300);">No stores found within ${RADIUS_MI} miles</h3>
        <p style="font-size:0.9rem;max-width:420px;margin:0 auto 12px;">Know a game store nearby? Help the community by adding it to OpenStreetMap.</p>
        <a href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener" class="btn btn-secondary">Add to OpenStreetMap →</a>
      </div>`;
    return;
  }

  container.innerHTML = stores.map(storeCardHTML).join('');
}

// ── Render Events ────────────────────────────────────────────
function renderEvents() {
  const container  = document.getElementById('events-list');
  const empty      = document.getElementById('events-empty');
  const typeFilter = document.getElementById('event-type').value;
  const freeOnly   = document.getElementById('free-filter').checked;
  const sort       = document.getElementById('event-sort').value;

  // Merge Eventbrite + community events; deduplicate by id
  const seen = new Set();
  const allEvents = [...liveEvents, ...localEvents].filter(e => {
    if (seen.has(String(e.id))) return false;
    seen.add(String(e.id));
    return true;
  });

  let events = [...allEvents];
  if (typeFilter) events = events.filter(e => e.type === typeFilter);
  if (freeOnly)   events = events.filter(e => e.cost === 'Free' || e.cost === '$0');

  if (sort === 'date')     events.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sort === 'distance') events.sort((a, b) => distanceMiles(a) - distanceMiles(b));
  if (sort === 'cost')     events.sort((a, b) => parseCost(a.cost) - parseCost(b.cost));

  empty.classList.toggle('hidden', events.length > 0);
  container.innerHTML = events.length === 0 ? '' : events.map(eventCardHTML).join('');
}

function parseCost(cost) {
  if (!cost || cost === 'Free' || cost === '$0') return 0;
  return parseFloat(cost.replace(/[^0-9.]/g, '')) || 0;
}

// ── UI Helpers ───────────────────────────────────────────────
function updatePageHeader() {
  if (!cityName) return;
  document.getElementById('local-scene-heading').textContent = `Local Indie Scene Near ${cityName}`;
  document.getElementById('location-area-label').textContent = cityName;
}

function setLocationStatus(msg) {
  document.getElementById('location-status-text').textContent = msg;
  document.getElementById('location-status-text').style.color = '';
}

function setLocationSuccess(msg) {
  const btn = document.getElementById('detect-location-btn');
  btn.textContent  = '✓ Location Set';
  btn.disabled     = false;
  btn.style.cssText = 'background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.35);color:#10b981;';
  document.getElementById('location-status-title').textContent = `📍 ${cityName || 'Location Set'}`;
  document.getElementById('location-status-text').textContent  = msg;
  document.getElementById('location-status-text').style.color  = '';
}

function setLocationError(msg) {
  const el = document.getElementById('location-status-text');
  el.textContent = msg;
  el.style.color = 'var(--danger)';
}

function setStoresStatus(msg) {
  document.getElementById('stores-grid').innerHTML =
    `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--gray-500);">${msg}</div>`;
}

function updateCounts() {
  document.getElementById('dev-count').textContent   = `(${localDevs.length})`;
  document.getElementById('store-count').textContent = `(${osmStores.length})`;
  document.getElementById('event-count').textContent = `(${liveEvents.length + localEvents.length})`;
}

function renderAll() {
  renderDevs();
  renderStores();
  renderEvents();
}

// ── Search ──────────────────────────────────────────────────
function handleLocalSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderAll(); return; }

  const devs = localDevs.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description || '').toLowerCase().includes(q) ||
    (d.city || d.location || '').toLowerCase().includes(q) ||
    (d.genres || []).some(g => g.toLowerCase().includes(q))
  );
  document.getElementById('devs-grid').innerHTML = devs.map(devCardHTML).join('');
  document.getElementById('devs-empty').classList.toggle('hidden', devs.length > 0);

  const stores = (userLat ? osmStores : []).filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.address || '').toLowerCase().includes(q) ||
    (s.type || '').toLowerCase().includes(q)
  );
  if (userLat) {
    document.getElementById('stores-grid').innerHTML = stores.length
      ? stores.map(storeCardHTML).join('')
      : `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--gray-500);">No stores match "${query}"</div>`;
  }

  const events = [...liveEvents, ...localEvents].filter(e =>
    e.name.toLowerCase().includes(q) ||
    (e.description || '').toLowerCase().includes(q) ||
    (e.location || '').toLowerCase().includes(q) ||
    (e.type || '').toLowerCase().includes(q)
  );
  document.getElementById('events-list').innerHTML = events.map(eventCardHTML).join('');
  document.getElementById('events-empty').classList.toggle('hidden', events.length > 0);
}

init();
