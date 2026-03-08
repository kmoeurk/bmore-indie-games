// BMore Indie Games — Local Scene JS

let localData = { developers: [], stores: [], events: [] };
let userLat = null;
let userLng = null;
let locationName = '';

// Baltimore city center as default
const BALTIMORE = { lat: 39.2904, lng: -76.6122 };

// ── Hamburger ──────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

// ── Init ───────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/local.json');
    localData = await res.json();
    updateCounts();
    renderDevs();
    renderStores();
    renderEvents();
  } catch (e) {
    console.error('Failed to load local data:', e);
  }
}

function updateCounts() {
  document.getElementById('dev-count').textContent   = `(${localData.developers.length})`;
  document.getElementById('store-count').textContent = `(${localData.stores.length})`;
  document.getElementById('event-count').textContent = `(${localData.events.length})`;
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
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      locationName = 'Your Location';
      setLocationSuccess(`Showing results near you (${userLat.toFixed(3)}, ${userLng.toFixed(3)})`);
      renderAll();
    },
    err => {
      btn.textContent = '📍 Use My Location';
      btn.disabled = false;
      if (err.code === 1) setLocationError('Location access denied. Enter a ZIP code instead.');
      else setLocationError('Could not detect location. Try a ZIP code.');
    },
    { timeout: 8000 }
  );
}

function useZipCode() {
  const zip = document.getElementById('zip-input').value.trim();
  if (!/^\d{5}$/.test(zip)) {
    document.getElementById('zip-input').style.borderColor = 'var(--danger)';
    return;
  }
  document.getElementById('zip-input').style.borderColor = '';

  // Approximate coordinates for Baltimore-area ZIP codes
  const zipMap = {
    '21201': { lat: 39.2984, lng: -76.6187 },
    '21202': { lat: 39.2905, lng: -76.6046 },
    '21205': { lat: 39.3008, lng: -76.5769 },
    '21210': { lat: 39.3456, lng: -76.6388 },
    '21211': { lat: 39.3390, lng: -76.6218 },
    '21212': { lat: 39.3609, lng: -76.6215 },
    '21213': { lat: 39.3122, lng: -76.5774 },
    '21214': { lat: 39.3554, lng: -76.5674 },
    '21215': { lat: 39.3461, lng: -76.6682 },
    '21216': { lat: 39.3122, lng: -76.6682 },
    '21217': { lat: 39.3097, lng: -76.6340 },
    '21218': { lat: 39.3265, lng: -76.6076 },
    '21223': { lat: 39.2835, lng: -76.6426 },
    '21224': { lat: 39.2759, lng: -76.5674 },
    '21225': { lat: 39.2469, lng: -76.6177 },
    '21229': { lat: 39.2888, lng: -76.6729 },
    '21230': { lat: 39.2722, lng: -76.6304 },
    '21231': { lat: 39.2902, lng: -76.5935 },
    '21234': { lat: 39.3911, lng: -76.5562 },
    '21239': { lat: 39.3659, lng: -76.5847 },
    '21204': { lat: 39.4036, lng: -76.5969 },
  };

  const coords = zipMap[zip] || BALTIMORE;
  userLat = coords.lat;
  userLng = coords.lng;
  locationName = `ZIP ${zip}`;
  setLocationSuccess(`Showing results near ZIP ${zip}`);
  renderAll();
}

function setLocationSuccess(msg) {
  const btn = document.getElementById('detect-location-btn');
  btn.textContent = '✓ Location Set';
  btn.disabled = false;
  btn.style.background = 'var(--success)';
  document.getElementById('location-status-title').textContent = '📍 ' + (locationName || 'Location Set');
  document.getElementById('location-status-text').textContent = msg;
}

function setLocationError(msg) {
  document.getElementById('location-status-text').textContent = msg;
  document.getElementById('location-status-text').style.color = 'var(--danger)';
}

// ── Distance Calculation ─────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistance(item) {
  const lat = userLat ?? BALTIMORE.lat;
  const lng = userLng ?? BALTIMORE.lng;
  const km = haversineKm(lat, lng, item.lat, item.lng);
  const miles = km * 0.621371;
  return { km, miles };
}

function fmtDistance(item) {
  const { miles } = getDistance(item);
  if (miles < 0.5) return 'Under 0.5 mi';
  return `${miles.toFixed(1)} mi`;
}

// ── Render Developers ───────────────────────────────────────
function renderDevs() {
  const container = document.getElementById('devs-grid');
  const empty     = document.getElementById('devs-empty');
  const genreFilter  = document.getElementById('dev-genre').value;
  const hiringOnly   = document.getElementById('hiring-filter').checked;
  const sort         = document.getElementById('dev-sort').value;

  let devs = [...localData.developers];
  if (genreFilter)  devs = devs.filter(d => (d.genres || []).includes(genreFilter));
  if (hiringOnly)   devs = devs.filter(d => d.hiring);

  if (sort === 'distance') devs.sort((a, b) => getDistance(a).miles - getDistance(b).miles);
  if (sort === 'name')     devs.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'founded')  devs.sort((a, b) => a.founded - b.founded);

  if (devs.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = devs.map(d => `
  <div class="card-dev">
    <div class="dev-header">
      <div class="dev-avatar">${d.name.charAt(0)}</div>
      <div class="dev-info">
        <div class="dev-name">${d.name}</div>
        <div class="dev-type">${d.type}</div>
      </div>
      ${d.hiring ? '<span class="dev-badge">Hiring</span>' : ''}
    </div>
    <div class="dev-description">${d.description}</div>
    <div class="dev-games">
      <strong>Games:</strong> ${d.games.join(', ')}
    </div>
    <div class="card-tags" style="margin-bottom:14px;">
      ${(d.genres || []).map(g => `<span class="tag tag-purple">${g}</span>`).join('')}
    </div>
    <div class="dev-footer">
      <div class="dev-location">📍 ${d.location}</div>
      <div class="dev-distance">${fmtDistance(d)}</div>
    </div>
  </div>`).join('');
}

// ── Render Stores ───────────────────────────────────────────
function renderStores() {
  const container  = document.getElementById('stores-grid');
  const indieOnly  = document.getElementById('indie-filter').checked;
  const sort       = document.getElementById('store-sort').value;

  let stores = [...localData.stores];
  if (indieOnly) stores = stores.filter(s => s.indieSection);

  if (sort === 'distance') stores.sort((a, b) => getDistance(a).miles - getDistance(b).miles);
  if (sort === 'name')     stores.sort((a, b) => a.name.localeCompare(b.name));

  const storeIcons = {
    'Retail + Arcade': '🕹',
    'Used Games':       '📀',
    'Gaming Lounge':    '🎮',
    'Esports Center':   '🏆',
  };

  container.innerHTML = stores.map(s => `
  <div class="card-store">
    <div class="store-header">
      <div class="store-icon">${storeIcons[s.type] || '🏪'}</div>
      <div>
        <div class="store-name">${s.name}</div>
        <div class="store-type">${s.type}</div>
      </div>
      <div style="margin-left:auto; font-size:0.85rem; color: var(--purple-400); font-weight:600;">${fmtDistance(s)}</div>
    </div>
    <div class="store-body">
      <p style="font-size:0.85rem; color: var(--gray-400); margin-bottom:12px; line-height:1.6;">${s.description}</p>
      <div class="store-address">📍 <span>${s.address}</span></div>
      <div class="store-hours">🕐 <span>${s.hours}</span></div>
      <div class="card-tags">
        ${(s.specialties || []).map(sp => `<span class="tag">${sp}</span>`).join('')}
        ${s.indieSection ? '<span class="tag tag-purple">Indie Section ✓</span>' : ''}
      </div>
    </div>
  </div>`).join('');
}

// ── Render Events ───────────────────────────────────────────
function renderEvents() {
  const container  = document.getElementById('events-list');
  const empty      = document.getElementById('events-empty');
  const typeFilter = document.getElementById('event-type').value;
  const freeOnly   = document.getElementById('free-filter').checked;
  const sort       = document.getElementById('event-sort').value;

  let events = [...localData.events];
  if (typeFilter) events = events.filter(e => e.type === typeFilter);
  if (freeOnly)   events = events.filter(e => e.cost === 'Free' || e.cost === '$0');

  if (sort === 'date')     events.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sort === 'distance') events.sort((a, b) => getDistance(a).miles - getDistance(b).miles);
  if (sort === 'cost')     events.sort((a, b) => parseCost(a.cost) - parseCost(b.cost));

  if (events.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = events.map(e => {
    const date   = new Date(e.date + 'T00:00:00');
    const month  = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const day    = date.getDate();
    const isFree = e.cost === 'Free' || e.cost === '$0';

    return `
    <div class="card-event">
      <div class="event-date-block">
        <div class="event-month">${month}</div>
        <div class="event-day">${day}</div>
      </div>
      <div class="event-info">
        <div class="event-name">${e.name}</div>
        <span class="event-type-badge">${e.type}</span>
        <div class="event-description">${e.description}</div>
        <div class="event-meta">
          <span>🕐 ${e.time}</span>
          <span>📍 ${e.location}</span>
          <span>📏 ${fmtDistance(e)}</span>
          <span>👥 ${e.attending} attending</span>
        </div>
        <div class="card-tags" style="margin-top:10px;">
          ${(e.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="event-aside">
        <div class="event-cost ${isFree ? 'free' : ''}">${e.cost}</div>
        <a href="${e.website}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:7px 16px; font-size:0.82rem;" onclick="event.stopPropagation()">Details →</a>
      </div>
    </div>`;
  }).join('');
}

function parseCost(cost) {
  if (cost === 'Free') return 0;
  return parseFloat(cost.replace(/[^0-9.]/g, '')) || 0;
}

function renderAll() {
  renderDevs();
  renderStores();
  renderEvents();
}

// ── Search ──────────────────────────────────────────────────
function handleLocalSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderAll();
    return;
  }
  // Search across all items
  ['devs', 'stores', 'events'].forEach(type => {
    const key = type === 'devs' ? 'developers' : type;
    const items = localData[key] || [];
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.location || '').toLowerCase().includes(q) ||
      (item.type || '').toLowerCase().includes(q) ||
      (item.genres || item.specialties || item.tags || []).some(t => t.toLowerCase().includes(q))
    );
    if (type === 'devs') {
      document.getElementById('devs-grid').innerHTML = filtered.map(d => devCardHTML(d)).join('');
    }
  });
}

function devCardHTML(d) {
  return `
  <div class="card-dev">
    <div class="dev-header">
      <div class="dev-avatar">${d.name.charAt(0)}</div>
      <div class="dev-info">
        <div class="dev-name">${d.name}</div>
        <div class="dev-type">${d.type}</div>
      </div>
      ${d.hiring ? '<span class="dev-badge">Hiring</span>' : ''}
    </div>
    <div class="dev-description">${d.description}</div>
    <div class="dev-games"><strong>Games:</strong> ${d.games.join(', ')}</div>
    <div class="card-tags" style="margin-bottom:14px;">
      ${(d.genres || []).map(g => `<span class="tag tag-purple">${g}</span>`).join('')}
    </div>
    <div class="dev-footer">
      <div class="dev-location">📍 ${d.location}</div>
      <div class="dev-distance">${fmtDistance(d)}</div>
    </div>
  </div>`;
}

init();
