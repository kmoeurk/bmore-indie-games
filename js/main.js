// BMore Indie Games — Homepage JS
// Loads game data, renders sections, handles filters + modal

let allGames = [];
let currentSort = 'trending';
let activeFilters = { genre: '', platform: '', price: '', players: '', status: '' };
let searchQuery = '';

const MOODS = [
  { key: 'intense',    label: 'Intense',     emoji: '⚡', color: 'rgba(239,68,68,0.2)'   },
  { key: 'chill',      label: 'Chill',       emoji: '🌿', color: 'rgba(16,185,129,0.2)'  },
  { key: 'story-rich', label: 'Story Rich',  emoji: '📖', color: 'rgba(245,158,11,0.2)'  },
  { key: 'challenging',label: 'Challenging', emoji: '💀', color: 'rgba(239,68,68,0.15)'  },
  { key: 'atmospheric',label: 'Atmospheric', emoji: '🌑', color: 'rgba(109,40,217,0.2)'  },
  { key: 'emotional',  label: 'Emotional',   emoji: '💜', color: 'rgba(139,92,246,0.2)'  },
  { key: 'mysterious', label: 'Mysterious',  emoji: '🔮', color: 'rgba(76,29,149,0.2)'   },
  { key: 'relaxing',   label: 'Relaxing',    emoji: '☁️', color: 'rgba(59,130,246,0.2)'  },
  { key: 'fun',        label: 'Fun',         emoji: '🎉', color: 'rgba(251,191,36,0.2)'  },
  { key: 'quirky',     label: 'Quirky',      emoji: '🦄', color: 'rgba(236,72,153,0.2)'  },
  { key: 'nostalgic',  label: 'Nostalgic',   emoji: '🕹',  color: 'rgba(20,184,166,0.2)'  },
];

// ── Hamburger ──────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

// ── Init ───────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/games.json');
    allGames = await res.json();
    renderFeatured();
    renderTrending();
    renderNewReleases();
    renderMoods();
    renderAllGames();
  } catch (e) {
    console.error('Failed to load games:', e);
  }

  // Also try to fetch from IGDB (will work on Vercel with env vars)
  fetchFromIGDB();
}

// ── IGDB Fetch (progressive enhancement) ──────────────────
async function fetchFromIGDB() {
  try {
    const res = await fetch('/api/igdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'games',
        body: 'fields name,cover.url,screenshots.url,genres.name,platforms.name,rating,involved_companies.company.name,first_release_date,summary,websites.url; where genres = (32) & rating > 75 & rating_count > 20 & cover > 0 & first_release_date > 0; sort rating desc; limit 50;'
      })
    });
    if (!res.ok) return;
    const igdbGames = await res.json();
    if (igdbGames && igdbGames.length > 0) {
      const mapped = igdbGames.map(mapIGDBGame);
      // Merge: IGDB games first, then local fallbacks not already included
      const igdbTitles = new Set(mapped.map(g => g.title.toLowerCase()));
      const localOnly = allGames.filter(g => !igdbTitles.has(g.title.toLowerCase()));
      allGames = [...mapped, ...localOnly];
      renderFeatured();
      renderTrending();
      renderNewReleases();
      renderAllGames();
    }
  } catch (_) {
    // IGDB unavailable — local data already shown
  }
}

function mapIGDBGame(g) {
  const thumb = g.cover?.url?.replace('t_thumb', 't_cover_big') || '';
  const screenshot = g.screenshots?.[0]?.url?.replace('t_thumb', 't_screenshot_big') || thumb;
  const dev = g.involved_companies?.[0]?.company?.name || 'Unknown Developer';
  const releaseDate = g.first_release_date
    ? new Date(g.first_release_date * 1000).toISOString().split('T')[0]
    : '';
  return {
    id: g.id,
    title: g.name,
    developer: dev,
    cover: thumb.startsWith('//') ? 'https:' + thumb : thumb,
    screenshot: screenshot.startsWith('//') ? 'https:' + screenshot : screenshot,
    genres: (g.genres || []).map(x => x.name),
    platforms: (g.platforms || []).map(x => x.name),
    rating: Math.round(g.rating || 0),
    price: 19.99,
    releaseStatus: 'released',
    releaseDate,
    players: 1,
    description: g.summary || '',
    mood: [],
    featured: true,
    trending: false,
    website: g.websites?.[0]?.url || '#',
    fromIGDB: true,
  };
}

// ── Render Featured ─────────────────────────────────────────
function renderFeatured() {
  const container = document.getElementById('featured-scroll');
  const featured = allGames.filter(g => g.featured).slice(0, 6);
  container.innerHTML = featured.map(g => cardFeaturedHTML(g)).join('');
}

function cardFeaturedHTML(g) {
  return `
  <div class="card-featured" onclick="openModal(${g.id})">
    <div class="card-cover">
      <img src="${g.cover}" alt="${g.title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect fill=%22%231e1e1e%22 width=%22300%22 height=%22200%22/><text fill=%22%239ca3af%22 font-size=%2240%22 x=%22150%22 y=%22110%22 text-anchor=%22middle%22>🎮</text></svg>'" loading="lazy">
      <div class="card-cover-overlay"></div>
      <span class="card-cover-badge">Featured</span>
    </div>
    <div class="card-body">
      <div class="card-developer">${g.developer}</div>
      <div class="card-title">${g.title}</div>
      <div class="card-tags">
        ${g.genres.slice(0,3).map(t => `<span class="tag tag-purple">${t}</span>`).join('')}
      </div>
      <div class="card-meta">
        <div class="card-rating"><span class="star">★</span> ${g.rating}</div>
        <div class="card-price ${g.price === 0 ? 'free' : ''}">${g.price === 0 ? 'Free' : '$' + g.price.toFixed(2)}</div>
      </div>
    </div>
  </div>`;
}

// ── Render Trending ─────────────────────────────────────────
function renderTrending() {
  const container = document.getElementById('trending-grid');
  const trending = allGames.filter(g => g.trending).slice(0, 6);
  container.innerHTML = trending.map(g => cardGameHTML(g)).join('') || '<p class="text-muted">No trending games.</p>';
}

// ── Render New Releases ─────────────────────────────────────
function renderNewReleases() {
  const container = document.getElementById('new-releases-grid');
  const sorted = [...allGames]
    .filter(g => g.releaseDate)
    .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
    .slice(0, 6);
  container.innerHTML = sorted.map(g => cardGameHTML(g)).join('');
}

// ── Render Moods ────────────────────────────────────────────
function renderMoods() {
  const container = document.getElementById('mood-grid');
  container.innerHTML = MOODS.map(m => {
    const count = allGames.filter(g => (g.mood || []).includes(m.key)).length;
    return `
    <div class="card-mood" style="--mood-color: ${m.color}" onclick="filterByMood('${m.key}')">
      <span class="mood-emoji">${m.emoji}</span>
      <div class="mood-label">${m.label}</div>
      <div class="mood-count">${count} game${count !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

// ── Render All Games ────────────────────────────────────────
function renderAllGames() {
  const container = document.getElementById('all-games-grid');
  const empty = document.getElementById('empty-state');
  const badge = document.getElementById('game-count-badge');

  let games = [...allGames];

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    games = games.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.developer.toLowerCase().includes(q) ||
      (g.genres || []).some(x => x.toLowerCase().includes(q))
    );
  }

  // Filters
  if (activeFilters.genre)    games = games.filter(g => (g.genres || []).includes(activeFilters.genre));
  if (activeFilters.platform) games = games.filter(g => (g.platforms || []).includes(activeFilters.platform));
  if (activeFilters.status)   games = games.filter(g => g.releaseStatus === activeFilters.status);
  if (activeFilters.players) {
    const n = parseInt(activeFilters.players);
    games = games.filter(g => g.players >= n);
  }
  if (activeFilters.price) {
    if (activeFilters.price === 'free')    games = games.filter(g => g.price === 0);
    if (activeFilters.price === 'under10') games = games.filter(g => g.price < 10);
    if (activeFilters.price === 'under20') games = games.filter(g => g.price < 20);
    if (activeFilters.price === 'under30') games = games.filter(g => g.price < 30);
  }

  // Sort
  if (currentSort === 'rating')   games.sort((a, b) => b.rating - a.rating);
  if (currentSort === 'new')      games.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  if (currentSort === 'trending') games.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0));

  badge.textContent = games.length;

  if (games.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    container.innerHTML = games.map(g => cardGameHTML(g)).join('');
  }
}

function cardGameHTML(g) {
  return `
  <div class="card-game" onclick="openModal(${g.id})">
    <div class="card-cover">
      <img src="${g.cover}" alt="${g.title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22300%22><rect fill=%22%221e1e1e%22 width=%22220%22 height=%22300%22/><text fill=%22%239ca3af%22 font-size=%2248%22 x=%22110%22 y=%22160%22 text-anchor=%22middle%22>🎮</text></svg>'" loading="lazy">
    </div>
    <div class="card-body">
      <div class="card-developer">${g.developer}</div>
      <div class="card-title">${g.title}</div>
      <div class="card-tags">
        ${(g.genres || []).slice(0,2).map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
      <div class="card-meta">
        <div class="card-rating"><span class="star">★</span> ${g.rating}</div>
        <div class="card-price ${g.price === 0 ? 'free' : ''}">${g.price === 0 ? 'Free' : '$' + g.price.toFixed(2)}</div>
      </div>
    </div>
  </div>`;
}

// ── Filters ─────────────────────────────────────────────────
function applyFilters() {
  activeFilters.genre    = document.getElementById('filter-genre').value;
  activeFilters.platform = document.getElementById('filter-platform').value;
  activeFilters.price    = document.getElementById('filter-price').value;
  activeFilters.players  = document.getElementById('filter-players').value;
  activeFilters.status   = document.getElementById('filter-status').value;
  renderAllGames();
}

function setSortChip(btn, sort) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentSort = sort;
  renderAllGames();
}

function resetFilters() {
  document.getElementById('filter-genre').value    = '';
  document.getElementById('filter-platform').value = '';
  document.getElementById('filter-price').value    = '';
  document.getElementById('filter-players').value  = '';
  document.getElementById('filter-status').value   = '';
  activeFilters = { genre: '', platform: '', price: '', players: '', status: '' };
  searchQuery = '';
  document.getElementById('nav-search-input').value = '';
  document.querySelectorAll('.filter-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  currentSort = 'trending';
  renderAllGames();
}

function filterByMood(mood) {
  const games = allGames.filter(g => (g.mood || []).includes(mood));
  const container = document.getElementById('all-games-grid');
  container.innerHTML = games.map(g => cardGameHTML(g)).join('');
  document.getElementById('game-count-badge').textContent = games.length;
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('all-games').scrollIntoView({ behavior: 'smooth' });
}

// ── Search ──────────────────────────────────────────────────
function handleSearch() {
  searchQuery = document.getElementById('nav-search-input').value.trim();
  renderAllGames();
  document.getElementById('all-games').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('nav-search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});

// ── Modal ───────────────────────────────────────────────────
function openModal(id) {
  const game = allGames.find(g => g.id === id);
  if (!game) return;

  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-screenshot').src   = game.screenshot || game.cover;
  document.getElementById('modal-developer').textContent = game.developer;
  document.getElementById('modal-title').textContent     = game.title;
  document.getElementById('modal-description').textContent = game.description;
  document.getElementById('modal-rating').textContent    = `★ ${game.rating} / 100`;
  document.getElementById('modal-price').textContent     = game.price === 0 ? 'Free' : `$${game.price.toFixed(2)}`;
  document.getElementById('modal-release').textContent   = game.releaseDate || 'TBA';
  document.getElementById('modal-players').textContent   = game.players === 1 ? 'Single Player' : `Up to ${game.players}`;
  document.getElementById('modal-website').href          = game.website || '#';

  document.getElementById('modal-tags').innerHTML =
    [...(game.genres || []), ...(game.platforms || [])].map(t => `<span class="tag">${t}</span>`).join('');

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Boot ────────────────────────────────────────────────────
init();
