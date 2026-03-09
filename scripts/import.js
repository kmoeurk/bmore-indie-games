/**
 * Data Import Script
 * Imports games.json → games table
 * Imports local.json → developers, stores, events tables
 * Uses the service key to bypass RLS.
 * Run once: node scripts/import.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ROOT      = path.join(__dirname, '..');
const GAMES_FILE = path.join(ROOT, 'data', 'games.json');
const LOCAL_FILE = path.join(ROOT, 'data', 'local.json');

// ── Helpers ──────────────────────────────────────────────────

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function upsertChunked(table, rows, conflictCol) {
  let inserted = 0;
  for (const chunk of chunkArray(rows, 100)) {
    const { error } = await admin.from(table).upsert(chunk, {
      onConflict: conflictCol,
      ignoreDuplicates: true,
    });
    if (error) console.error(`  [${table}] chunk error:`, error.message);
    else inserted += chunk.length;
  }
  return inserted;
}

// ── Map games.json → games table row ─────────────────────────

function mapGame(g) {
  const screenshots = [];
  if (g.screenshot && g.screenshot !== g.cover) screenshots.push(g.screenshot);

  let releaseDate = null;
  if (g.releaseDate && g.releaseDate !== '') {
    try { releaseDate = new Date(g.releaseDate).toISOString().split('T')[0]; }
    catch { releaseDate = null; }
  }

  return {
    title:            g.title || 'Untitled',
    developer:        g.developer || null,
    description_short: (g.description || '').slice(0, 160) || null,
    description_long:  g.description || null,
    genre:            g.genres || [],
    platform:         g.platforms || [],
    price:            typeof g.price === 'number' ? g.price : 0,
    rating:           g.rating || null,
    cover_image_url:  g.cover || null,
    screenshots:      screenshots,
    website_url:      g.website || null,
    release_date:     releaseDate,
    release_status:   g.releaseStatus || null,
    mood_tags:        g.mood || [],
    players:          g.players || 1,
    featured:         g.featured || false,
    trending:         g.trending || false,
    source:           g.source || (g.fromIGDB ? 'igdb' : 'crawler'),
    igdb_id:          g.fromIGDB ? (g.id || null) : null,
  };
}

// ── Map local.json developer → developers table row ──────────

function mapDeveloper(d) {
  return {
    name:         d.name,
    studio_name:  d.name,
    studio_type:  d.type || null,
    city:         d.city || null,
    state:        d.state || null,
    country:      'USA',
    latitude:     d.lat || null,
    longitude:    d.lng || null,
    bio:          d.description || null,
    website:      d.website || null,
    social_links: d.twitter ? { twitter: d.twitter } : {},
    games_made:   d.games || [],
    genres:       d.genres || [],
    hiring:       d.hiring || false,
    founded_year: d.founded || null,
  };
}

// ── Map local.json store → stores table row ───────────────────

function mapStore(s) {
  return {
    name:          s.name,
    store_type:    s.type || null,
    address:       s.address || null,
    city:          s.city || null,
    state:         s.state || null,
    latitude:      s.lat || null,
    longitude:     s.lng || null,
    hours:         s.hours || null,
    website:       s.website || null,
    phone:         null,
    specialties:   s.specialties || [],
    indie_section: s.indieSection || false,
    description:   s.description || null,
  };
}

// ── Map local.json event → events table row ───────────────────

function mapEvent(e) {
  let eventDate = null;
  if (e.date) {
    try { eventDate = new Date(e.date).toISOString().split('T')[0]; }
    catch { eventDate = null; }
  }
  return {
    name:             e.name,
    description:      e.description || null,
    event_type:       e.type || null,
    event_date:       eventDate,
    event_time:       e.time || null,
    city:             e.city || null,
    state:            e.state || null,
    latitude:         e.lat || null,
    longitude:        e.lng || null,
    address:          e.address || null,
    registration_url: e.website || null,
    cost:             e.cost || null,
    tags:             e.tags || [],
    attending:        e.attending || 0,
    source:           'community',
    eventbrite_id:    null,
  };
}

// ── Main ─────────────────────────────────────────────────────

async function run() {
  // 1. Import games
  console.log('Reading games.json…');
  const rawGames = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
  console.log(`  ${rawGames.length} games found`);

  const gameRows = rawGames.map(mapGame);
  console.log('Inserting games…');
  const gamesInserted = await upsertChunked('games', gameRows, 'id');
  console.log(`  ${gamesInserted} games processed.`);

  // 2. Import local data
  console.log('\nReading local.json…');
  const local = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));

  // Developers
  const devRows = (local.developers || []).map(mapDeveloper);
  console.log(`  ${devRows.length} developers → inserting…`);
  const { error: devErr } = await admin.from('developers').insert(devRows);
  if (devErr) console.error('  developers error:', devErr.message);
  else console.log(`  ${devRows.length} developers inserted.`);

  // Stores
  const storeRows = (local.stores || []).map(mapStore);
  console.log(`  ${storeRows.length} stores → inserting…`);
  const { error: storeErr } = await admin.from('stores').insert(storeRows);
  if (storeErr) console.error('  stores error:', storeErr.message);
  else console.log(`  ${storeRows.length} stores inserted.`);

  // Events
  const eventRows = (local.events || []).map(mapEvent);
  console.log(`  ${eventRows.length} events → inserting…`);
  const { error: eventErr } = await admin.from('events').insert(eventRows);
  if (eventErr) console.error('  events error:', eventErr.message);
  else console.log(`  ${eventRows.length} events inserted.`);

  console.log('\nImport complete ✓');
}

run().catch(err => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
